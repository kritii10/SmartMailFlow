import type { Server } from "node:http";
import { app } from "./app.js";
import { env } from "./config.js";

export type ApiServerHandle = {
  server: Server;
  close: () => Promise<void>;
};

export const startApiServer = async (): Promise<ApiServerHandle> => {
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`API listening on 0.0.0.0:${env.PORT}`);
  });

  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
};
