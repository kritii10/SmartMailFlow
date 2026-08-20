import { Redis } from "ioredis";
import { env } from "./config.js";

const createRedisConnection = (connectionName: string) =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName
  });

const withErrorLogging = (client: Redis, connectionName: string) => {
  client.on("error", (error) => {
    console.error(`[redis:${connectionName}]`, error.message);
  });

  return client;
};

export const redisConnection = withErrorLogging(
  createRedisConnection("reachinbox-app"),
  "reachinbox-app"
);
export const redisForBullMq = withErrorLogging(
  createRedisConnection("reachinbox-queue"),
  "reachinbox-queue"
);
export const redisForBullMqWorker = withErrorLogging(
  createRedisConnection("reachinbox-worker"),
  "reachinbox-worker"
);
export const redisForBullMqEvents = withErrorLogging(
  createRedisConnection("reachinbox-events"),
  "reachinbox-events"
);

const redisClients = [
  redisConnection,
  redisForBullMq,
  redisForBullMqWorker,
  redisForBullMqEvents
];

export const closeRedisConnections = async () => {
  await Promise.allSettled(
    redisClients.map(async (client) => {
      if (client.status === "end") {
        return;
      }

      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    })
  );
};
