import { env } from "../config.js";
import { redisConnection } from "../redis.js";

const SEND_THROTTLE_KEY = "email-send-throttle:global";
const THROTTLE_KEY_TTL_MS = Math.max(env.MIN_EMAIL_DELAY_MS * 20, 60_000);

const reserveSendSlotScript = `
local key = KEYS[1]
local minDelayMs = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])

local timeParts = redis.call("TIME")
local nowMs = (tonumber(timeParts[1]) * 1000) + math.floor(tonumber(timeParts[2]) / 1000)
local nextAllowedMs = tonumber(redis.call("GET", key) or "0")

local reservedAtMs = nowMs
if nextAllowedMs > nowMs then
  reservedAtMs = nextAllowedMs
end

local nextWindowMs = reservedAtMs + minDelayMs
redis.call("SET", key, tostring(nextWindowMs), "PX", ttlMs)

return { tostring(nowMs), tostring(reservedAtMs), tostring(nextWindowMs) }
`;

export type ReservedSendSlot = {
  nowMs: number;
  reservedAtMs: number;
  nextWindowMs: number;
  waitMs: number;
};

export const reserveNextSendSlot = async (): Promise<ReservedSendSlot> => {
  const result = (await redisConnection.eval(
    reserveSendSlotScript,
    1,
    SEND_THROTTLE_KEY,
    `${env.MIN_EMAIL_DELAY_MS}`,
    `${THROTTLE_KEY_TTL_MS}`
  )) as [string, string, string];

  const nowMs = Number(result[0]);
  const reservedAtMs = Number(result[1]);
  const nextWindowMs = Number(result[2]);

  return {
    nowMs,
    reservedAtMs,
    nextWindowMs,
    waitMs: Math.max(reservedAtMs - Date.now(), 0)
  };
};

export const sleepFor = async (durationMs: number) => {
  if (durationMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};
