import { randomUUID } from "node:crypto";

process.env.NODE_ENV ??= "test";
process.env.EMAIL_QUEUE_NAME ??= "email-scheduler-load-test";
process.env.GOOGLE_CLIENT_ID ??= "load-test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "load-test-google-client-secret";
process.env.GOOGLE_REDIRECT_URI ??= "http://localhost:4000/api/auth/google/callback";
process.env.LOAD_TEST_EMAILS ??= "1000";
process.env.WORKER_CONCURRENCY ??= "5";
process.env.MAX_EMAILS_PER_HOUR ??= "100";
process.env.MIN_EMAIL_DELAY_MS ??= "25";

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const main = async () => {
  const [
    { Worker, DelayedError },
    { prisma, disconnectPrisma },
    { env },
    { emailQueue, emailQueueEvents, closeQueueResources, EMAIL_JOB_NAME },
    { closeRedisConnections, redisConnection, redisForBullMqWorker },
    {
      createEmailJobProcessor
    },
    {
      claimScheduledEmailForProcessing,
      incrementEmailAttempts,
      markEmailFailed,
      markEmailRetryableFailure,
      markEmailSent,
      rescheduleProcessingEmail
    },
    { buildHourlyRateLimitKey, getNextHourWindowStart }
  ] = await Promise.all([
    import("bullmq"),
    import("../prisma.js"),
    import("../config.js"),
    import("../queue.js"),
    import("../redis.js"),
    import("../services/email-worker.service.js"),
    import("../services/email.service.js"),
    import("../services/rate-limit.service.js")
  ]);
  type EmailJobPayload = import("../queue.js").EmailJobPayload;

  const totalEmails = parsePositiveInteger(process.env.LOAD_TEST_EMAILS, 1000);
  const duplicateJobAttemptsRequested = parsePositiveInteger(
    process.env.LOAD_TEST_DUPLICATE_JOB_ATTEMPTS,
    Math.min(50, totalEmails)
  );
  const duplicateJobAttempts = Math.min(duplicateJobAttemptsRequested, totalEmails);
  const startDelayMs = parsePositiveInteger(process.env.LOAD_TEST_START_DELAY_MS, 1500);
  const fakeSendDurationMs = parseNonNegativeInteger(process.env.LOAD_TEST_FAKE_SEND_MS, 5);
  const workerConcurrency = env.WORKER_CONCURRENCY;
  const minEmailDelayMs = env.MIN_EMAIL_DELAY_MS;
  const maxEmailsPerHour = env.MAX_EMAILS_PER_HOUR;
  const expectedImmediateSends = Math.min(totalEmails, maxEmailsPerHour);
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const testUserEmail = "load-test@reachinbox.local";
  const senderEmail = `load-test-sender-${runId}@example.com`;
  const senderName = "ReachInbox Load Test";
  const subject = `load-test:${runId}`;
  const startTime = new Date(Date.now() + startDelayMs);
  const startedAtMs = Date.now();
  const pollIntervalMs = 200;
  const timeoutMs =
    parsePositiveInteger(process.env.LOAD_TEST_TIMEOUT_MS, 0) ||
    startDelayMs +
      expectedImmediateSends * Math.max(minEmailDelayMs, 1) +
      expectedImmediateSends * fakeSendDurationMs +
      15_000;

  const stats = {
    totalScheduled: totalEmails,
    jobsCreated: 0,
    jobsProcessed: 0,
    jobsRescheduled: 0,
    sent: 0,
    failed: 0,
    duplicateAttemptsPrevented: 0,
    maxConcurrentJobHandlers: 0
  };

  let activeJobHandlers = 0;
  let loadTestUserId = "";
  let createdEmailIds: string[] = [];
  let worker: import("bullmq").Worker<EmailJobPayload> | null = null;
  let delayedJobsAfterDuplicateAttemptsCount = 0;
  let duplicateQueueJobsAfterDuplicateAttempts = 0;

  const cleanup = async () => {
    await Promise.allSettled([worker?.close()]);
    await Promise.allSettled([
      emailQueue.obliterate({ force: true }).catch(() => undefined),
      loadTestUserId
        ? prisma.email.deleteMany({
            where: {
              userId: loadTestUserId
            }
          })
        : Promise.resolve()
    ]);

    const nextHour = getNextHourWindowStart(startTime);
    await redisConnection.del(
      "email-send-throttle:global",
      buildHourlyRateLimitKey(senderEmail, startTime),
      buildHourlyRateLimitKey(senderEmail, nextHour)
    );

    await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
  };

  try {
    const user = await prisma.user.upsert({
      where: {
        email: testUserEmail
      },
      update: {
        name: "Load Test User",
        googleId: "load-test-google-user"
      },
      create: {
        email: testUserEmail,
        name: "Load Test User",
        googleId: "load-test-google-user"
      }
    });

    loadTestUserId = user.id;

    await prisma.email.deleteMany({
      where: {
        userId: loadTestUserId
      }
    });

    await emailQueue.obliterate({ force: true }).catch(() => undefined);

    const emailRecords = Array.from({ length: totalEmails }, (_, index) => {
      const id = `load-${runId}-${`${index + 1}`.padStart(5, "0")}`;

      return {
        id,
        userId: loadTestUserId,
        senderEmail,
        senderName,
        recipientEmail: `load-test+${runId}-${index + 1}@example.com`,
        subject,
        body: `Load test batch ${runId} email ${index + 1}`,
        scheduledAt: startTime,
        sentAt: null,
        bullJobId: id,
        idempotencyKey: randomUUID(),
        attempts: 0,
        failedAt: null,
        lastError: null,
        status: "SCHEDULED" as const
      };
    });

    createdEmailIds = emailRecords.map((email) => email.id);

    await prisma.email.createMany({
      data: emailRecords
    });

    const createdJobs = await emailQueue.addBulk(
      emailRecords.map((email) => ({
        name: EMAIL_JOB_NAME,
        data: {
          emailId: email.id
        },
        opts: {
          jobId: email.id,
          delay: Math.max(startTime.getTime() - Date.now(), 0)
        }
      }))
    );

    stats.jobsCreated = createdJobs.length;

    const queueCountsBeforeDuplicates = await emailQueue.getJobCounts("delayed");

    await emailQueue.addBulk(
      emailRecords.slice(0, duplicateJobAttempts).map((email) => ({
        name: EMAIL_JOB_NAME,
        data: {
          emailId: email.id
        },
        opts: {
          jobId: email.id,
          delay: Math.max(startTime.getTime() - Date.now(), 0)
        }
      }))
    );

    const delayedJobsAfterDuplicateAttempts = await emailQueue.getJobs(["delayed"], 0, -1, true);
    delayedJobsAfterDuplicateAttemptsCount = delayedJobsAfterDuplicateAttempts.length;
    const uniqueDelayedJobIds = new Set(
      delayedJobsAfterDuplicateAttempts.map((job) => `${job.id ?? ""}`)
    );
    const duplicateJobsCreated =
      delayedJobsAfterDuplicateAttempts.length - uniqueDelayedJobIds.size;
    duplicateQueueJobsAfterDuplicateAttempts = duplicateJobsCreated;
    const extraJobsAfterDuplicateAttempts =
      delayedJobsAfterDuplicateAttempts.length - queueCountsBeforeDuplicates.delayed;

    stats.duplicateAttemptsPrevented = Math.max(
      duplicateJobAttempts - Math.max(extraJobsAfterDuplicateAttempts, 0),
      0
    );

    const processor = createEmailJobProcessor({
      claimScheduledEmailForProcessing: async (emailId) => claimScheduledEmailForProcessing(emailId),
      incrementEmailAttempts: async (emailId) => incrementEmailAttempts(emailId),
      markEmailSent: async (emailId) => {
        stats.sent += 1;
        await markEmailSent(emailId);
      },
      markEmailFailed: async (emailId, errorMessage) => {
        stats.failed += 1;
        await markEmailFailed(emailId, errorMessage);
      },
      markEmailRetryableFailure: async (emailId, errorMessage) => {
        await markEmailRetryableFailure(emailId, errorMessage);
      },
      rescheduleProcessingEmail: async (emailId, scheduledAt, errorMessage) => {
        stats.jobsRescheduled += 1;
        await rescheduleProcessingEmail(emailId, scheduledAt, errorMessage);
      },
      sendEmail: async () => {
        if (fakeSendDurationMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, fakeSendDurationMs);
          });
        }

        return {
          messageId: `load-test-${randomUUID()}`
        } as never;
      },
      getEmailPreviewUrl: () => false,
      logger: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    });

    const currentWorker = new Worker<EmailJobPayload>(env.EMAIL_QUEUE_NAME, async (job, token) => {
      stats.jobsProcessed += 1;
      activeJobHandlers += 1;
      stats.maxConcurrentJobHandlers = Math.max(
        stats.maxConcurrentJobHandlers,
        activeJobHandlers
      );

      try {
        await processor(job, token);
      } catch (error) {
        if (error instanceof DelayedError) {
          throw error;
        }

        throw error;
      } finally {
        activeJobHandlers -= 1;
      }
    }, {
      connection: redisForBullMqWorker,
      concurrency: workerConcurrency,
      autorun: false
    });
    worker = currentWorker;

    emailQueueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`[load-test] job failed ${jobId ?? "unknown"}: ${failedReason}`);
    });

    void currentWorker.run().catch((error) => {
      console.error(
        error instanceof Error ? `[load-test] worker run loop failed: ${error.message}` : error
      );
    });

    const deadline = Date.now() + timeoutMs;
    let settled = false;

    while (Date.now() < deadline) {
      const counts = await emailQueue.getJobCounts("active", "waiting", "delayed");

      if (
        stats.jobsProcessed >= totalEmails &&
        counts.active === 0 &&
        counts.waiting === 0
      ) {
        settled = true;
        break;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, pollIntervalMs);
      });
    }

    if (!settled) {
      throw new Error(
        `Load test timed out after ${timeoutMs}ms with jobsProcessed=${stats.jobsProcessed}.`
      );
    }

    const persistedEmails = await prisma.email.findMany({
      where: {
        id: {
          in: createdEmailIds
        }
      },
      select: {
        id: true,
        bullJobId: true,
        status: true,
        lastError: true
      }
    });

    const remainingDelayedJobs = await emailQueue.getJobs(["delayed"], 0, -1, true);
    const remainingDelayedJobIds = new Set(remainingDelayedJobs.map((job) => `${job.id ?? ""}`));
    const uniqueEmailIds = new Set(persistedEmails.map((email) => email.id));
    const uniqueBullJobIds = new Set(
      persistedEmails.map((email) => email.bullJobId).filter((value): value is string => Boolean(value))
    );
    const rescheduledRows = persistedEmails.filter(
      (email) =>
        email.status === "SCHEDULED" &&
        email.lastError?.includes("Rescheduled due to hourly rate limit")
    ).length;
    const sentRows = persistedEmails.filter((email) => email.status === "SENT").length;
    const failedRows = persistedEmails.filter((email) => email.status === "FAILED").length;
    const duplicateEmailRecords = persistedEmails.length - uniqueEmailIds.size;
    const duplicateQueueJobs =
      duplicateQueueJobsAfterDuplicateAttempts +
      (remainingDelayedJobs.length - remainingDelayedJobIds.size);
    const elapsedMs = Date.now() - startedAtMs;

    if (persistedEmails.length !== totalEmails) {
      throw new Error(
        `Expected ${totalEmails} persisted emails, found ${persistedEmails.length}.`
      );
    }

    if (stats.jobsCreated !== totalEmails) {
      throw new Error(`Expected ${totalEmails} jobs, created ${stats.jobsCreated}.`);
    }

    if (duplicateEmailRecords !== 0) {
      throw new Error(`Detected ${duplicateEmailRecords} duplicate email records.`);
    }

    if (duplicateQueueJobs !== 0) {
      throw new Error(`Detected ${duplicateQueueJobs} duplicate queue jobs.`);
    }

    console.log("");
    console.log("ReachInbox Load Test Summary");
    console.log(`run_id: ${runId}`);
    console.log(`queue_name: ${env.EMAIL_QUEUE_NAME}`);
    console.log(`load_test_emails: ${totalEmails}`);
    console.log(`worker_concurrency: ${workerConcurrency}`);
    console.log(`min_email_delay_ms: ${minEmailDelayMs}`);
    console.log(`max_emails_per_hour: ${maxEmailsPerHour}`);
    console.log(`scheduled_start_time: ${startTime.toISOString()}`);
    console.log(`total_scheduled: ${persistedEmails.length}`);
    console.log(`jobs_created: ${stats.jobsCreated}`);
    console.log(`jobs_processed: ${stats.jobsProcessed}`);
    console.log(`jobs_rescheduled: ${stats.jobsRescheduled}`);
    console.log(`sent: ${sentRows}`);
    console.log(`failed: ${failedRows}`);
    console.log(`duplicate_attempts_prevented: ${stats.duplicateAttemptsPrevented}`);
    console.log(`remaining_delayed_jobs: ${remainingDelayedJobs.length}`);
    console.log(`rescheduled_rows_in_future_windows: ${rescheduledRows}`);
    console.log(`max_concurrent_job_handlers_observed: ${stats.maxConcurrentJobHandlers}`);
    console.log(`unique_email_records: ${uniqueEmailIds.size}`);
    console.log(`unique_bull_job_ids: ${uniqueBullJobIds.size}`);
    console.log(`elapsed_ms: ${elapsedMs}`);
  } finally {
    await cleanup();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
