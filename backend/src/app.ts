import cors from "cors";
import express from "express";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { redisConnection } from "./redis.js";
import { authRouter } from "./routes/auth.routes.js";
import { emailRouter } from "./routes/email.routes.js";

export const app = express();

app.set("trust proxy", 1);

const resolveAllowedOrigins = () => {
  const configuredOrigin = new URL(env.FRONTEND_URL);
  const allowedOrigins = new Set([configuredOrigin.origin]);

  if (configuredOrigin.hostname === "localhost") {
    allowedOrigins.add(
      `${configuredOrigin.protocol}//127.0.0.1${configuredOrigin.port ? `:${configuredOrigin.port}` : ""}`
    );
  }

  if (configuredOrigin.hostname === "127.0.0.1") {
    allowedOrigins.add(
      `${configuredOrigin.protocol}//localhost${configuredOrigin.port ? `:${configuredOrigin.port}` : ""}`
    );
  }

  return allowedOrigins;
};

const allowedOrigins = resolveAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));

app.get(["/health", "/api/health"], async (_request, response) => {
  const [databaseCheck, redisCheck] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redisConnection.ping()
  ]);

  response.json({
    status: "ok",
    services: {
      database: databaseCheck.status === "fulfilled" ? "ok" : "unavailable",
      redis: redisCheck.status === "fulfilled" ? "ok" : "unavailable"
    }
  });
});

app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);
