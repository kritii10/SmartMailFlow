import { env } from "../config.js";
import { redisConnection } from "../redis.js";

const RATE_LIMIT_KEY_PREFIX = "email-rate";
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

const reserveHourlySlotScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])

local current = tonumber(redis.call("GET", key) or "0")
if current >= limit then
  return { "0", tostring(current) }
end

current = redis.call("INCR", key)
if current == 1 then
  redis.call("PEXPIRE", key, ttlMs)
end

return { "1", tostring(current) }
`;

type RedisEvalClient = {
  eval: (
    script: string,
    numKeys: number,
    ...args: string[]
  ) => Promise<unknown>;
};

export type HourlyRateLimitResult = {
  allowed: boolean;
  retryAt?: Date;
  currentUsage: number;
  limit: number;
  hourWindow: string;
  key: string;
};

type ReserveHourlyRateLimitSlotInput = {
  senderId: string;
  now?: Date;
  redis?: RedisEvalClient;
  maxEmailsPerHour?: number;
  keyPrefix?: string;
};

export const formatHourWindow = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hour = `${date.getUTCHours()}`.padStart(2, "0");
  return `${year}-${month}-${day}-${hour}`;
};

export const getNextHourWindowStart = (date: Date) => {
  const nextHour = new Date(date);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return nextHour;
};

export const buildHourlyRateLimitKey = (
  senderId: string,
  date: Date,
  keyPrefix = RATE_LIMIT_KEY_PREFIX
) => `${keyPrefix}:${senderId}:${formatHourWindow(date)}`;

const getHourlyCounterTtlMs = (date: Date) => {
  const nextHour = getNextHourWindowStart(date);
  return Math.max(nextHour.getTime() - date.getTime() + HOURLY_WINDOW_MS, HOURLY_WINDOW_MS);
};

export const reserveHourlyRateLimitSlot = async ({
  senderId,
  now = new Date(),
  redis = redisConnection,
  maxEmailsPerHour = env.MAX_EMAILS_PER_HOUR,
  keyPrefix = RATE_LIMIT_KEY_PREFIX
}: ReserveHourlyRateLimitSlotInput): Promise<HourlyRateLimitResult> => {
  const hourWindow = formatHourWindow(now);
  const key = buildHourlyRateLimitKey(senderId, now, keyPrefix);
  const ttlMs = getHourlyCounterTtlMs(now);

  const result = (await redis.eval(
    reserveHourlySlotScript,
    1,
    key,
    `${maxEmailsPerHour}`,
    `${ttlMs}`
  )) as [string, string];

  const allowed = result[0] === "1";
  const currentUsage = Number(result[1]);

  if (allowed) {
    return {
      allowed: true,
      currentUsage,
      limit: maxEmailsPerHour,
      hourWindow,
      key
    };
  }

  return {
    allowed: false,
    retryAt: getNextHourWindowStart(now),
    currentUsage,
    limit: maxEmailsPerHour,
    hourWindow,
    key
  };
};
