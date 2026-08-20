import { after, test } from "node:test";
import assert from "node:assert/strict";
import { DelayedError } from "bullmq";
import { disconnectPrisma } from "../prisma.js";
import { closeQueueResources } from "../queue.js";
import { closeRedisConnections } from "../redis.js";
import { createEmailJobProcessor } from "./email-worker.service.js";

after(async () => {
  await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
});

test("reschedules to the next hour when the sender is rate limited", async () => {
  const retryAt = new Date("2026-08-20T11:00:00.000Z");
  const logs: string[] = [];
  const rescheduled: Array<{ emailId: string; scheduledAt: Date; errorMessage?: string | null }> =
    [];
  let moveToDelayedTimestamp: number | null = null;
  let sendCalled = false;

  const processor = createEmailJobProcessor({
    logger: {
      log: (message: string) => logs.push(message),
      warn: (message: string) => logs.push(message),
      error: (message: string) => logs.push(message)
    },
    now: () => new Date("2026-08-20T10:30:00.000Z"),
    getEmailById: async () => ({
      id: "email-rate-limited",
      userId: "user-1",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      recipientEmail: "recipient@example.com",
      subject: "subject",
      body: "body",
      scheduledAt: new Date("2026-08-20T10:00:00.000Z"),
      sentAt: null,
      bullJobId: "email-rate-limited",
      idempotencyKey: "idempotency-rate-limited",
      attempts: 0,
      failedAt: null,
      lastError: null,
      status: "SCHEDULED",
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T10:00:00.000Z")
    }),
    claimScheduledEmailForProcessing: async () => ({
      id: "email-rate-limited",
      userId: "user-1",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      recipientEmail: "recipient@example.com",
      subject: "subject",
      body: "body",
      scheduledAt: new Date("2026-08-20T10:00:00.000Z"),
      sentAt: null,
      bullJobId: "email-rate-limited",
      idempotencyKey: "idempotency-rate-limited",
      attempts: 0,
      failedAt: null,
      lastError: null,
      status: "PROCESSING",
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T10:00:00.000Z")
    }),
    reserveHourlyRateLimitSlot: async () => ({
      allowed: false,
      retryAt,
      currentUsage: 100,
      limit: 100,
      hourWindow: "2026-08-20-10",
      key: "email-rate:sender@example.com:2026-08-20-10"
    }),
    rescheduleProcessingEmail: async (emailId, scheduledAt, errorMessage) => {
      rescheduled.push({ emailId, scheduledAt, errorMessage });
    },
    reserveNextSendSlot: async () => ({
      nowMs: Date.now(),
      reservedAtMs: Date.now(),
      nextWindowMs: Date.now(),
      waitMs: 0
    }),
    sleepFor: async () => undefined,
    incrementEmailAttempts: async () => undefined,
    sendEmail: async () => {
      sendCalled = true;
      throw new Error("send should not be called");
    },
    markEmailSent: async () => undefined,
    markEmailFailed: async () => undefined,
    markEmailRetryableFailure: async () => undefined,
    getEmailPreviewUrl: () => false
  });

  const job = {
    data: { emailId: "email-rate-limited" },
    attemptsMade: 0,
    opts: { attempts: 3 },
    moveToDelayed: async (timestamp: number) => {
      moveToDelayedTimestamp = timestamp;
    }
  } as const;

  await assert.rejects(
    processor(job as never, "worker-token"),
    (error: unknown) => error instanceof DelayedError
  );

  assert.equal(sendCalled, false);
  assert.equal(rescheduled.length, 1);
  assert.equal(rescheduled[0]?.scheduledAt.toISOString(), retryAt.toISOString());
  assert.equal(moveToDelayedTimestamp, retryAt.getTime());
  assert.ok(logs.some((message) => message.includes("allowed=false")));
  assert.ok(logs.some((message) => message.includes(`retryAt=${retryAt.toISOString()}`)));
});

test("moves a future email back to delayed if the job is delivered too early", async () => {
  let moveToDelayedTimestamp: number | null = null;
  let sendCalled = false;

  const processor = createEmailJobProcessor({
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    now: () => new Date("2026-08-20T10:00:00.000Z"),
    getEmailById: async () => ({
      id: "email-future",
      userId: "user-1",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      recipientEmail: "recipient@example.com",
      subject: "subject",
      body: "body",
      scheduledAt: new Date("2026-08-20T10:15:00.000Z"),
      sentAt: null,
      bullJobId: "email-future",
      idempotencyKey: "idempotency-future",
      attempts: 0,
      failedAt: null,
      lastError: null,
      status: "SCHEDULED",
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T10:00:00.000Z")
    }),
    claimScheduledEmailForProcessing: async () => {
      throw new Error("claim should not be called for a future email");
    },
    reserveHourlyRateLimitSlot: async () => {
      throw new Error("rate limit should not be checked for a future email");
    },
    rescheduleProcessingEmail: async () => undefined,
    reserveNextSendSlot: async () => ({
      nowMs: Date.now(),
      reservedAtMs: Date.now(),
      nextWindowMs: Date.now(),
      waitMs: 0
    }),
    sleepFor: async () => undefined,
    incrementEmailAttempts: async () => undefined,
    sendEmail: async () => {
      sendCalled = true;
      throw new Error("send should not be called");
    },
    markEmailSent: async () => undefined,
    markEmailFailed: async () => undefined,
    markEmailRetryableFailure: async () => undefined,
    getEmailPreviewUrl: () => false
  });

  const job = {
    data: { emailId: "email-future" },
    attemptsMade: 0,
    opts: { attempts: 3 },
    moveToDelayed: async (timestamp: number) => {
      moveToDelayedTimestamp = timestamp;
    }
  } as const;

  await assert.rejects(
    processor(job as never, "worker-token"),
    (error: unknown) => error instanceof DelayedError
  );

  assert.equal(sendCalled, false);
  assert.equal(moveToDelayedTimestamp, new Date("2026-08-20T10:15:00.000Z").getTime());
});
