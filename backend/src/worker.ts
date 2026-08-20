import { disconnectPrisma } from "./prisma.js";
import { closeQueueResources } from "./queue.js";
import { closeRedisConnections } from "./redis.js";
import { startEmailWorker } from "./worker-runner.js";

let shuttingDown = false;

const start = async () => {
  const workerHandle = await startEmailWorker();

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down worker...`);

    await Promise.allSettled([
      workerHandle.close(),
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
};

void start().catch(async (error) => {
  console.error("Worker failed to start cleanly.", error);
  await Promise.allSettled([
    closeQueueResources(),
    closeRedisConnections(),
    disconnectPrisma()
  ]);
  process.exit(1);
});
