import { Worker } from "bullmq";
import { env } from "./config.js";
import { emailQueueEvents, type EmailJobPayload } from "./queue.js";
import { redisForBullMqWorker } from "./redis.js";
import { createEmailJobProcessor } from "./services/email-worker.service.js";
import {
  reconcileEmailQueueState,
  recoverStalledEmailJob
} from "./services/restart-recovery.service.js";
import { setWorkerRuntimeStatus } from "./worker-state.js";

const processEmailJob = createEmailJobProcessor();

let queueEventHandlersRegistered = false;

const registerQueueEventHandlers = () => {
  if (queueEventHandlersRegistered) {
    return;
  }

  queueEventHandlersRegistered = true;

  emailQueueEvents.on("completed", ({ jobId }) => {
    console.log(`Email job completed: ${jobId}`);
  });

  emailQueueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(`Email job failed: ${jobId}`, failedReason);
  });

  emailQueueEvents.on("stalled", ({ jobId }) => {
    console.warn(`Email job stalled: ${jobId}`);

    if (!jobId) {
      return;
    }

    void recoverStalledEmailJob(jobId).catch((error) => {
      console.error(`Failed to recover stalled job ${jobId}.`, error);
    });
  });
};

export type EmailWorkerHandle = {
  worker: Worker<EmailJobPayload>;
  close: () => Promise<void>;
};

export const startEmailWorker = async (): Promise<EmailWorkerHandle> => {
  registerQueueEventHandlers();
  setWorkerRuntimeStatus("starting");

  const worker = new Worker<EmailJobPayload>(env.EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redisForBullMqWorker,
    concurrency: env.WORKER_CONCURRENCY,
    autorun: false
  });

  worker.on("closed", () => {
    setWorkerRuntimeStatus("stopped");
  });

  worker.on("error", (error) => {
    setWorkerRuntimeStatus("error");
    console.error("BullMQ worker emitted an error.", error);
  });

  await reconcileEmailQueueState();

  void worker.run().catch((error) => {
    setWorkerRuntimeStatus("error");
    console.error("Worker run loop terminated unexpectedly.", error);
  });

  setWorkerRuntimeStatus("running");
  console.log(`Worker started with concurrency ${env.WORKER_CONCURRENCY}`);

  return {
    worker,
    close: async () => {
      setWorkerRuntimeStatus("stopping");
      await worker.close();
    }
  };
};
