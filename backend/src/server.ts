import { app } from "./app.js";
import { env } from "./config.js";
import { disconnectPrisma } from "./prisma.js";
import { closeQueueResources } from "./queue.js";
import { closeRedisConnections } from "./redis.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on 0.0.0.0:${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down API server...`);

  server.close(async (error) => {
    if (error) {
      console.error("Error while closing HTTP server.", error);
      process.exitCode = 1;
    }

    await Promise.allSettled([
      closeQueueResources(),
      closeRedisConnections(),
      disconnectPrisma()
    ]);

    process.exit();
  });
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
