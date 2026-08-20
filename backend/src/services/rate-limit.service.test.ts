import { after, test } from "node:test";
import assert from "node:assert/strict";
import { closeRedisConnections, redisConnection } from "../redis.js";
import {
  buildHourlyRateLimitKey,
  getNextHourWindowStart,
  reserveHourlyRateLimitSlot
} from "./rate-limit.service.js";

const testPrefix = "email-rate-test";
const baseDate = new Date("2026-08-20T10:15:00.000Z");

const cleanupKey = async (senderId: string, date = baseDate) => {
  await redisConnection.del(buildHourlyRateLimitKey(senderId, date, testPrefix));
};

after(async () => {
  await closeRedisConnections();
});

test("allows sends below the hourly limit", async () => {
  const senderId = "below-limit";
  await cleanupKey(senderId);

  const first = await reserveHourlyRateLimitSlot({
    senderId,
    now: baseDate,
    maxEmailsPerHour: 3,
    keyPrefix: testPrefix
  });

  assert.equal(first.allowed, true);
  assert.equal(first.currentUsage, 1);

  await cleanupKey(senderId);
});

test("allows exactly up to the configured limit", async () => {
  const senderId = "exact-limit";
  await cleanupKey(senderId);

  const first = await reserveHourlyRateLimitSlot({
    senderId,
    now: baseDate,
    maxEmailsPerHour: 2,
    keyPrefix: testPrefix
  });
  const second = await reserveHourlyRateLimitSlot({
    senderId,
    now: baseDate,
    maxEmailsPerHour: 2,
    keyPrefix: testPrefix
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.currentUsage, 2);

  await cleanupKey(senderId);
});

test("blocks sends above the hourly limit", async () => {
  const senderId = "above-limit";
  await cleanupKey(senderId);

  await reserveHourlyRateLimitSlot({
    senderId,
    now: baseDate,
    maxEmailsPerHour: 1,
    keyPrefix: testPrefix
  });
  const blocked = await reserveHourlyRateLimitSlot({
    senderId,
    now: baseDate,
    maxEmailsPerHour: 1,
    keyPrefix: testPrefix
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.currentUsage, 1);
  assert.equal(blocked.retryAt?.toISOString(), getNextHourWindowStart(baseDate).toISOString());

  await cleanupKey(senderId);
});

test("shares the final available slot safely across concurrent workers", async () => {
  const senderId = "concurrent-limit";
  await cleanupKey(senderId);

  const results = await Promise.all([
    reserveHourlyRateLimitSlot({
      senderId,
      now: baseDate,
      maxEmailsPerHour: 1,
      keyPrefix: testPrefix
    }),
    reserveHourlyRateLimitSlot({
      senderId,
      now: baseDate,
      maxEmailsPerHour: 1,
      keyPrefix: testPrefix
    })
  ]);

  const allowedCount = results.filter((result) => result.allowed).length;
  const blockedCount = results.filter((result) => !result.allowed).length;

  assert.equal(allowedCount, 1);
  assert.equal(blockedCount, 1);

  await cleanupKey(senderId);
});
