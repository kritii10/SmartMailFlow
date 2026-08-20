import { startApiServer } from "./api-server.js";
import { disconnectPrisma } from "./prisma.js";
import { closeQueueResources } from "./queue.js";
import { closeRedisConnections } from "./redis.js";
import { startEmailWorker } from "./worker-runner.js";

let shuttingDown = false;

const start = async () => {
  const [apiServer, workerHandle] = await Promise.all([startApiServer(), startEmailWorker()]);

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down API and worker...`);

    await Promise.allSettled([apiServer.close(), workerHandle.close()]);
    await Promise.allSettled([
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
  console.error("Combined API/worker service failed to start cleanly.", error);
  await Promise.allSettled([
    closeQueueResources(),
    closeRedisConnections(),
    disconnectPrisma()
  ]);
  process.exit(1);
});
