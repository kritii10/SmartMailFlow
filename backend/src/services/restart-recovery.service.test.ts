import { after, test } from "node:test";
import assert from "node:assert/strict";
import { disconnectPrisma } from "../prisma.js";
import { closeQueueResources } from "../queue.js";
import { closeRedisConnections } from "../redis.js";
import { reconcileEmailQueueState, recoverStalledEmailJob } from "./restart-recovery.service.js";

after(async () => {
  await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
});

test("reconciles a missing queue job by re-enqueueing the scheduled email", async () => {
  const enqueued: Array<{ id: string; scheduledAt: Date }> = [];

  const summary = await reconcileEmailQueueState({
    listRecoverableEmails: async () => [
      {
        id: "email-missing-job",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-08-20T11:00:00.000Z"),
        bullJobId: "email-missing-job",
        createdAt: new Date("2026-08-20T10:00:00.000Z"),
        updatedAt: new Date("2026-08-20T10:00:00.000Z")
      }
    ],
    getQueueJob: async () => null,
    enqueueEmailJob: async (email) => {
      enqueued.push(email);
      return {
        ...email,
        bullJobId: email.id
      } as never;
    },
    rescheduleProcessingEmail: async () => undefined,
    updateEmailBullJobId: async () => undefined as never,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0]?.id, "email-missing-job");
  assert.equal(enqueued[0]?.scheduledAt.toISOString(), "2026-08-20T11:00:00.000Z");
  assert.equal(summary.inspected, 1);
  assert.equal(summary.requeued, 1);
  assert.equal(summary.resetToScheduled, 0);
});

test("resets a non-active processing email back to scheduled without recreating its waiting job", async () => {
  const rescheduled: Array<{ emailId: string; scheduledAt: Date; errorMessage?: string | null }> =
    [];
  const enqueued: string[] = [];

  const summary = await reconcileEmailQueueState({
    listRecoverableEmails: async () => [
      {
        id: "email-processing",
        status: "PROCESSING",
        scheduledAt: new Date("2026-08-20T11:00:00.000Z"),
        bullJobId: "email-processing",
        createdAt: new Date("2026-08-20T10:00:00.000Z"),
        updatedAt: new Date("2026-08-20T10:00:00.000Z")
      }
    ],
    getQueueJob: async () => ({
      id: "email-processing",
      data: {
        emailId: "email-processing"
      },
      getState: async () => "waiting",
      remove: async () => undefined
    }),
    enqueueEmailJob: async (email) => {
      enqueued.push(email.id);
      return {
        ...email,
        bullJobId: email.id
      } as never;
    },
    rescheduleProcessingEmail: async (emailId, scheduledAt, errorMessage) => {
      rescheduled.push({ emailId, scheduledAt, errorMessage });
    },
    updateEmailBullJobId: async () => undefined as never,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  assert.equal(enqueued.length, 0);
  assert.equal(summary.requeued, 0);
  assert.equal(summary.resetToScheduled, 1);
  assert.equal(rescheduled.length, 1);
  assert.match(
    rescheduled[0]?.errorMessage ?? "",
    /Recovered to SCHEDULED after worker restart before completion/
  );
});

test("keeps active processing emails untouched during startup reconciliation", async () => {
  const summary = await reconcileEmailQueueState({
    listRecoverableEmails: async () => [
      {
        id: "email-active",
        status: "PROCESSING",
        scheduledAt: new Date("2026-08-20T11:00:00.000Z"),
        bullJobId: "email-active",
        createdAt: new Date("2026-08-20T10:00:00.000Z"),
        updatedAt: new Date("2026-08-20T10:00:00.000Z")
      }
    ],
    getQueueJob: async () => ({
      id: "email-active",
      data: {
        emailId: "email-active"
      },
      getState: async () => "active",
      remove: async () => undefined
    }),
    enqueueEmailJob: async () => {
      throw new Error("active jobs should not be recreated");
    },
    rescheduleProcessingEmail: async () => {
      throw new Error("active jobs should not be reset");
    },
    updateEmailBullJobId: async () => undefined as never,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  assert.equal(summary.requeued, 0);
  assert.equal(summary.resetToScheduled, 0);
  assert.equal(summary.activeProcessingKept, 1);
});

test("stalled job recovery returns the email row to scheduled", async () => {
  const rescheduled: Array<{ emailId: string; scheduledAt: Date; errorMessage?: string | null }> =
    [];

  await recoverStalledEmailJob("job-stalled", {
    getQueueJob: async () => ({
      id: "job-stalled",
      data: {
        emailId: "email-stalled"
      },
      getState: async () => "waiting",
      remove: async () => undefined
    }),
    getEmailById: async () => ({
      id: "email-stalled",
      userId: "user-1",
      senderEmail: "sender@example.com",
      senderName: "Sender",
      recipientEmail: "recipient@example.com",
      subject: "subject",
      body: "body",
      scheduledAt: new Date("2026-08-20T11:00:00.000Z"),
      sentAt: null,
      bullJobId: "email-stalled",
      idempotencyKey: "idempotency-stalled",
      attempts: 1,
      failedAt: null,
      lastError: null,
      status: "PROCESSING",
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T10:30:00.000Z")
    }),
    rescheduleProcessingEmail: async (emailId, scheduledAt, errorMessage) => {
      rescheduled.push({ emailId, scheduledAt, errorMessage });
    },
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  assert.equal(rescheduled.length, 1);
  assert.equal(rescheduled[0]?.emailId, "email-stalled");
  assert.match(
    rescheduled[0]?.errorMessage ?? "",
    /Recovered to SCHEDULED after BullMQ stalled-job detection/
  );
});
