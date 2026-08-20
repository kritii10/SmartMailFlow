import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  EMAIL_QUEUE_NAME: z.string().default("email-scheduler"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(100),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  AUTH_COOKIE_NAME: z.string().min(1).default("reachinbox_session"),
  OAUTH_STATE_COOKIE_NAME: z.string().min(1).default("reachinbox_oauth_state"),
  OAUTH_STATE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  SESSION_TTL_MS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60 * 1000),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_SECURE: z.enum(["true", "false"]).optional()
});

const rawEnv = {
  ...process.env,
  GOOGLE_CLIENT_SECRET:
    process.env.GOOGLE_CLIENT_SECRET ??
    (process.env.NODE_ENV === "test" ? "test-google-client-secret" : undefined),
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ??
    (process.env.NODE_ENV === "test"
      ? "http://localhost:4000/api/auth/google/callback"
      : undefined)
};

export const env = envSchema.parse(rawEnv);

export const isSecureCookieEnabled =
  env.COOKIE_SECURE === undefined ? env.NODE_ENV === "production" : env.COOKIE_SECURE === "true";
