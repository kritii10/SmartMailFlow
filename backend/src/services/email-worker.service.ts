import { DelayedError, Job } from "bullmq";
import { Email } from "@prisma/client";
import { EmailJobPayload, EMAIL_JOB_ATTEMPTS } from "../queue.js";
import {
  claimScheduledEmailForProcessing,
  getEmailById,
  incrementEmailAttempts,
  markEmailFailed,
  markEmailRetryableFailure,
  markEmailSent,
  rescheduleProcessingEmail
} from "./email.service.js";
import { HourlyRateLimitResult, reserveHourlyRateLimitSlot } from "./rate-limit.service.js";
import { reserveNextSendSlot, sleepFor } from "./send-throttle.service.js";
import { getEmailPreviewUrl, sendEmail } from "./smtp.service.js";

type Logger = Pick<typeof console, "log" | "warn" | "error">;

type ProcessorDependencies = {
  getEmailById: typeof getEmailById;
  claimScheduledEmailForProcessing: typeof claimScheduledEmailForProcessing;
  incrementEmailAttempts: typeof incrementEmailAttempts;
  markEmailSent: typeof markEmailSent;
  markEmailFailed: typeof markEmailFailed;
  markEmailRetryableFailure: typeof markEmailRetryableFailure;
  rescheduleProcessingEmail: typeof rescheduleProcessingEmail;
  reserveHourlyRateLimitSlot: (input: {
    senderId: string;
    now?: Date;
  }) => Promise<HourlyRateLimitResult>;
  reserveNextSendSlot: typeof reserveNextSendSlot;
  sleepFor: typeof sleepFor;
  sendEmail: typeof sendEmail;
  getEmailPreviewUrl: typeof getEmailPreviewUrl;
  logger: Logger;
  now: () => Date;
};

const defaultDependencies: ProcessorDependencies = {
  getEmailById,
  claimScheduledEmailForProcessing,
  incrementEmailAttempts,
  markEmailSent,
  markEmailFailed,
  markEmailRetryableFailure,
  rescheduleProcessingEmail,
  reserveHourlyRateLimitSlot,
  reserveNextSendSlot,
  sleepFor,
  sendEmail,
  getEmailPreviewUrl,
  logger: console,
  now: () => new Date()
};

const renderFromAddress = (email: Email) =>
  email.senderName ? `"${email.senderName}" <${email.senderEmail}>` : email.senderEmail;

export const createEmailJobProcessor = (
  overrides: Partial<ProcessorDependencies> = {}
) => {
  const dependencies = {
    ...defaultDependencies,
    ...overrides
  };

  return async (job: Job<EmailJobPayload>, token?: string) => {
    const persistedEmail = await dependencies.getEmailById(job.data.emailId);

    if (!persistedEmail) {
      dependencies.logger.warn(`Email ${job.data.emailId} was not found. Acknowledging job.`);
      return;
    }

    const now = dependencies.now();

    if (persistedEmail.status === "SCHEDULED" && persistedEmail.scheduledAt.getTime() > now.getTime()) {
      dependencies.logger.warn(
        `Email ${persistedEmail.id} was delivered before ${persistedEmail.scheduledAt.toISOString()}. Returning job to delayed state.`
      );

      if (token) {
        await job.moveToDelayed(persistedEmail.scheduledAt.getTime(), token);
        throw new DelayedError();
      }

      return;
    }

    if (persistedEmail.status === "SENT") {
      dependencies.logger.warn(
        `Email ${persistedEmail.id} is SENT. Skipping duplicate or stale job.`
      );
      return;
    }

    if (persistedEmail.status !== "SCHEDULED") {
      dependencies.logger.warn(
        `Email ${persistedEmail.id} is ${persistedEmail.status}. Skipping duplicate or stale job.`
      );
      return;
    }

    const claimedEmail = await dependencies.claimScheduledEmailForProcessing(job.data.emailId);

    if (!claimedEmail) {
      dependencies.logger.warn(`Email ${job.data.emailId} was already claimed by another worker.`);
      return;
    }

    const rateLimit = await dependencies.reserveHourlyRateLimitSlot({
      senderId: claimedEmail.senderEmail,
      now: dependencies.now()
    });

    dependencies.logger.log(
      `[rate-limit] sender=${claimedEmail.senderEmail} window=${rateLimit.hourWindow} usage=${rateLimit.currentUsage}/${rateLimit.limit} allowed=${rateLimit.allowed}${rateLimit.retryAt ? ` retryAt=${rateLimit.retryAt.toISOString()}` : ""}`
    );

    if (!rateLimit.allowed) {
      if (!rateLimit.retryAt) {
        throw new Error("Rate limit rejection did not provide retryAt.");
      }

      await dependencies.rescheduleProcessingEmail(
        claimedEmail.id,
        rateLimit.retryAt,
        `Rescheduled due to hourly rate limit until ${rateLimit.retryAt.toISOString()}`
      );

      if (token) {
        await job.moveToDelayed(rateLimit.retryAt.getTime(), token);
        throw new DelayedError();
      }

      return;
    }

    const reservedSlot = await dependencies.reserveNextSendSlot();

    if (reservedSlot.waitMs > 0) {
      dependencies.logger.log(
        `[${dependencies.now().toISOString()}] Reserved send slot for ${claimedEmail.id} at ${new Date(
          reservedSlot.reservedAtMs
        ).toISOString()} after waiting ${reservedSlot.waitMs}ms`
      );
      await dependencies.sleepFor(reservedSlot.waitMs);
    }

    await dependencies.incrementEmailAttempts(claimedEmail.id);

    dependencies.logger.log(
      `[${dependencies.now().toISOString()}] Sending email ${claimedEmail.id} to ${claimedEmail.recipientEmail}`
    );

    try {
      const info = await dependencies.sendEmail({
        from: renderFromAddress(claimedEmail),
        to: claimedEmail.recipientEmail,
        subject: claimedEmail.subject,
        text: claimedEmail.body,
        html: `<pre style="font-family: inherit; white-space: pre-wrap;">${claimedEmail.body}</pre>`
      });

      await dependencies.markEmailSent(claimedEmail.id);

      const previewUrl = dependencies.getEmailPreviewUrl(info);
      if (previewUrl) {
        dependencies.logger.log(`Ethereal preview URL for ${claimedEmail.id}: ${previewUrl}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown SMTP error.";
      const totalAttempts = job.opts.attempts ?? EMAIL_JOB_ATTEMPTS;
      const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;

      if (isFinalAttempt) {
        await dependencies.markEmailFailed(claimedEmail.id, errorMessage);
      } else {
        await dependencies.markEmailRetryableFailure(claimedEmail.id, errorMessage);
      }

      throw error;
    }
  };
};
