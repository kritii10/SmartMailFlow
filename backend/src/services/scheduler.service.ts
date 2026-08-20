import { randomUUID } from "node:crypto";
import { Email, Prisma } from "@prisma/client";
import { env } from "../config.js";
import { prisma } from "../prisma.js";
import { emailQueue, EMAIL_JOB_NAME } from "../queue.js";
import { getDelayMs } from "../utils/date.js";
import { formatHourWindow, getNextHourWindowStart } from "./rate-limit.service.js";

export type ScheduleEmailsInput = {
  userId: string;
  senderEmail?: string;
  senderName?: string;
  subject: string;
  body: string;
  startTime: Date;
  delayMs: number;
  hourlyLimit?: number;
  recipients: string[];
};

type ScheduledRecipientPlan = {
  recipientEmail: string;
  scheduledAt: Date;
};

const getEffectiveHourlyLimit = (hourlyLimit?: number) =>
  Math.min(hourlyLimit ?? env.MAX_EMAILS_PER_HOUR, env.MAX_EMAILS_PER_HOUR);

export const buildRecipientSchedulePlan = (
  startTime: Date,
  delayMs: number,
  recipients: string[],
  hourlyLimit?: number
): ScheduledRecipientPlan[] => {
  const limit = getEffectiveHourlyLimit(hourlyLimit);
  const plan: ScheduledRecipientPlan[] = [];
  let nextScheduledAt = new Date(startTime);
  let activeHourWindow = formatHourWindow(nextScheduledAt);
  let emailsInHour = 0;

  for (const recipientEmail of recipients) {
    const candidateHourWindow = formatHourWindow(nextScheduledAt);

    if (candidateHourWindow !== activeHourWindow) {
      activeHourWindow = candidateHourWindow;
      emailsInHour = 0;
    }

    if (emailsInHour >= limit) {
      nextScheduledAt = getNextHourWindowStart(nextScheduledAt);
      activeHourWindow = formatHourWindow(nextScheduledAt);
      emailsInHour = 0;
    }

    const scheduledAt = new Date(nextScheduledAt);
    plan.push({
      recipientEmail,
      scheduledAt
    });

    emailsInHour += 1;
    nextScheduledAt = new Date(scheduledAt.getTime() + delayMs);
  }

  return plan;
};

export const enqueueEmailJob = async (email: Pick<Email, "id" | "scheduledAt">) => {
  const job = await emailQueue.add(
    EMAIL_JOB_NAME,
    {
      emailId: email.id
    },
    {
      jobId: email.id,
      delay: getDelayMs(email.scheduledAt)
    }
  );

  const bullJobId = job.id ?? email.id;

  return prisma.email.update({
    where: {
      id: email.id
    },
    data: {
      bullJobId
    }
  });
};

export const scheduleEmailRecord = async (email: Email) => enqueueEmailJob(email);

export const rescheduleEmailJob = async (email: Email) => {
  if (email.bullJobId) {
    await emailQueue.remove(email.bullJobId).catch(() => undefined);
  }

  return enqueueEmailJob(email);
};

export const scheduleEmailBatch = async (input: ScheduleEmailsInput) => {
  const senderEmail = input.senderEmail?.trim() || env.SMTP_USER;
  const senderName = input.senderName?.trim() || "ReachInbox Scheduler";

  if (!senderEmail) {
    throw new Error("SMTP_USER must be configured before scheduling emails.");
  }

  const schedulePlan = buildRecipientSchedulePlan(
    input.startTime,
    input.delayMs,
    input.recipients,
    input.hourlyLimit
  );

  const createdEmails = await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const emails: Email[] = [];

    for (const recipient of schedulePlan) {
      const email = await transaction.email.create({
        data: {
          userId: input.userId,
          senderEmail,
          senderName,
          recipientEmail: recipient.recipientEmail,
          subject: input.subject,
          body: input.body,
          scheduledAt: recipient.scheduledAt,
          idempotencyKey: randomUUID(),
          status: "SCHEDULED"
        }
      });

      emails.push(email);
    }

    return emails;
  });

  const scheduledEmails: Email[] = [];

  try {
    for (const email of createdEmails) {
      const scheduledEmail = await enqueueEmailJob(email);
      scheduledEmails.push(scheduledEmail);
    }
  } catch (error) {
    await Promise.allSettled(
      scheduledEmails.map((email) => emailQueue.remove(email.bullJobId ?? email.id))
    );

    await prisma.email.deleteMany({
      where: {
        id: {
          in: createdEmails.map((email) => email.id)
        }
      }
    });

    throw error;
  }

  return {
    createdCount: scheduledEmails.length,
    senderEmail,
    senderName,
    hourlyLimitApplied: getEffectiveHourlyLimit(input.hourlyLimit),
    delayMs: input.delayMs,
    startTime: input.startTime,
    emails: scheduledEmails
  };
};
