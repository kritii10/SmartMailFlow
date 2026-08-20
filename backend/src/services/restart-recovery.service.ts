import { Job } from "bullmq";
import { emailQueue, EmailJobPayload } from "../queue.js";
import {
  getEmailById,
  listRecoverableEmails,
  RecoverableEmail,
  rescheduleProcessingEmail,
  updateEmailBullJobId
} from "./email.service.js";
import { enqueueEmailJob } from "./scheduler.service.js";

type Logger = Pick<typeof console, "log" | "warn" | "error">;

type QueueJobState = Awaited<ReturnType<Job<EmailJobPayload>["getState"]>>;

type QueueJobHandle = Pick<Job<EmailJobPayload>, "id" | "data" | "getState" | "remove">;

type RestartRecoveryDependencies = {
  listRecoverableEmails: () => Promise<RecoverableEmail[]>;
  getEmailById: typeof getEmailById;
  getQueueJob: (jobId: string) => Promise<QueueJobHandle | null>;
  enqueueEmailJob: typeof enqueueEmailJob;
  rescheduleProcessingEmail: typeof rescheduleProcessingEmail;
  updateEmailBullJobId: typeof updateEmailBullJobId;
  logger: Logger;
};

export type RestartRecoverySummary = {
  inspected: number;
  requeued: number;
  resetToScheduled: number;
  activeProcessingKept: number;
  repairedBullJobIds: number;
};

const defaultDependencies: RestartRecoveryDependencies = {
  listRecoverableEmails,
  getEmailById,
  getQueueJob: async (jobId) => (await emailQueue.getJob(jobId)) ?? null,
  enqueueEmailJob,
  rescheduleProcessingEmail,
  updateEmailBullJobId,
  logger: console
};

const ACTIVE_JOB_STATES = new Set<string>(["active"]);
const TERMINAL_JOB_STATES = new Set<string>(["completed", "failed", "unknown"]);

const getCandidateJobIds = (email: Pick<RecoverableEmail, "id" | "bullJobId">) => {
  const jobIds = new Set<string>();

  if (email.bullJobId) {
    jobIds.add(email.bullJobId);
  }

  jobIds.add(email.id);

  return [...jobIds];
};

const getExistingQueueJob = async (
  email: Pick<RecoverableEmail, "id" | "bullJobId">,
  dependencies: RestartRecoveryDependencies
) => {
  for (const jobId of getCandidateJobIds(email)) {
    const job = await dependencies.getQueueJob(jobId);

    if (job) {
      return job;
    }
  }

  return null;
};

const safelyReenqueueEmailJob = async (
  email: Pick<RecoverableEmail, "id" | "scheduledAt">,
  dependencies: RestartRecoveryDependencies
) => {
  try {
    await dependencies.enqueueEmailJob(email);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown queue error.";

    if (message.toLowerCase().includes("job id already exists")) {
      return false;
    }

    throw error;
  }
};

export const reconcileEmailQueueState = async (
  overrides: Partial<RestartRecoveryDependencies> = {}
): Promise<RestartRecoverySummary> => {
  const dependencies = {
    ...defaultDependencies,
    ...overrides
  };

  const emails = await dependencies.listRecoverableEmails();
  const summary: RestartRecoverySummary = {
    inspected: emails.length,
    requeued: 0,
    resetToScheduled: 0,
    activeProcessingKept: 0,
    repairedBullJobIds: 0
  };

  for (const email of emails) {
    const existingJob = await getExistingQueueJob(email, dependencies);
    const jobState = existingJob ? await existingJob.getState() : null;

    if (existingJob?.id && email.bullJobId !== existingJob.id) {
      await dependencies.updateEmailBullJobId(email.id, existingJob.id);
      summary.repairedBullJobIds += 1;
    }

    if (email.status === "PROCESSING") {
      if (jobState && ACTIVE_JOB_STATES.has(jobState)) {
        summary.activeProcessingKept += 1;
        continue;
      }

      await dependencies.rescheduleProcessingEmail(
        email.id,
        email.scheduledAt,
        "Recovered to SCHEDULED after worker restart before completion."
      );
      summary.resetToScheduled += 1;
    }

    if (!existingJob || (jobState && TERMINAL_JOB_STATES.has(jobState))) {
      if (existingJob) {
        await existingJob.remove().catch(() => undefined);
      }

      const wasEnqueued = await safelyReenqueueEmailJob(email, dependencies);

      if (wasEnqueued) {
        summary.requeued += 1;
      }
    }
  }

  dependencies.logger.log(
    `[restart-recovery] inspected=${summary.inspected} requeued=${summary.requeued} resetToScheduled=${summary.resetToScheduled} activeProcessingKept=${summary.activeProcessingKept} repairedBullJobIds=${summary.repairedBullJobIds}`
  );

  return summary;
};

export const recoverStalledEmailJob = async (
  jobId: string,
  overrides: Partial<RestartRecoveryDependencies> = {}
) => {
  const dependencies = {
    ...defaultDependencies,
    ...overrides
  };

  const job = await dependencies.getQueueJob(jobId);

  if (!job?.data?.emailId) {
    dependencies.logger.warn(
      `[restart-recovery] stalled job ${jobId} could not be mapped back to an email row.`
    );
    return;
  }

  const email = await dependencies.getEmailById(job.data.emailId);

  if (!email) {
    dependencies.logger.warn(
      `[restart-recovery] stalled job ${jobId} references missing email ${job.data.emailId}.`
    );
    return;
  }

  if (email.status !== "PROCESSING") {
    return;
  }

  await dependencies.rescheduleProcessingEmail(
    email.id,
    email.scheduledAt,
    "Recovered to SCHEDULED after BullMQ stalled-job detection."
  );

  dependencies.logger.warn(
    `[restart-recovery] reset stalled email ${email.id} back to SCHEDULED.`
  );
};
