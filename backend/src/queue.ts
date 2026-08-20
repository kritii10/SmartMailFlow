import { Queue, QueueEvents } from "bullmq";
import { env } from "./config.js";
import { redisForBullMq, redisForBullMqEvents } from "./redis.js";

export const EMAIL_JOB_NAME = "send-email";
export const EMAIL_JOB_ATTEMPTS = 3;
export const EMAIL_JOB_BACKOFF_DELAY_MS = 5000;

export type EmailJobPayload = {
  emailId: string;
};

export const emailQueue = new Queue<EmailJobPayload>(env.EMAIL_QUEUE_NAME, {
  connection: redisForBullMq,
  defaultJobOptions: {
    attempts: EMAIL_JOB_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: EMAIL_JOB_BACKOFF_DELAY_MS
    },
    removeOnComplete: 1000,
    removeOnFail: 1000
  }
});

export const emailQueueEvents = new QueueEvents(env.EMAIL_QUEUE_NAME, {
  connection: redisForBullMqEvents
});

export const closeQueueResources = async () => {
  await Promise.allSettled([emailQueue.close(), emailQueueEvents.close()]);
};
