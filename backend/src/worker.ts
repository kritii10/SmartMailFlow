import { Worker } from "bullmq";
import { env } from "./config.js";
import { disconnectPrisma } from "./prisma.js";
import {
  closeQueueResources,
  emailQueueEvents,
  EmailJobPayload
} from "./queue.js";
import { closeRedisConnections, redisForBullMqWorker } from "./redis.js";
import { createEmailJobProcessor } from "./services/email-worker.service.js";
import {
  reconcileEmailQueueState,
  recoverStalledEmailJob
} from "./services/restart-recovery.service.js";

const processEmailJob = createEmailJobProcessor();

const worker = new Worker<EmailJobPayload>(env.EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisForBullMqWorker,
  concurrency: env.WORKER_CONCURRENCY,
  autorun: false
});

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

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down worker...`);
  await Promise.allSettled([
    worker.close(),
    closeQueueResources(),
    closeRedisConnections(),
    disconnectPrisma()
  ]);
  process.exit();
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

const startWorker = async () => {
  await reconcileEmailQueueState();
  void worker.run().catch((error) => {
    console.error("Worker run loop terminated unexpectedly.", error);
  });
  console.log(`Worker started with concurrency ${env.WORKER_CONCURRENCY}`);
};

void startWorker().catch(async (error) => {
  console.error("Worker failed to start cleanly.", error);
  await shutdown("startup failure");
});
