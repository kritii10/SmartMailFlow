import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { disconnectPrisma, prisma } from "../prisma.js";
import { closeQueueResources } from "../queue.js";
import { closeRedisConnections } from "../redis.js";
import {
  claimScheduledEmailForProcessing,
  getEmailById
} from "./email.service.js";
import { createEmailJobProcessor } from "./email-worker.service.js";

const TEST_USER_EMAIL = "email-service-tests@reachinbox.local";

const resetEmailRows = async () => {
  const user = await prisma.user.upsert({
    where: {
      email: TEST_USER_EMAIL
    },
    update: {
      name: "Email Service Tests",
      googleId: "email-service-tests-google"
    },
    create: {
      email: TEST_USER_EMAIL,
      name: "Email Service Tests",
      googleId: "email-service-tests-google"
    }
  });

  await prisma.email.deleteMany({
    where: {
      userId: user.id
    }
  });

  return user;
};

const createScheduledEmailRow = async (overrides: Partial<Prisma.EmailUncheckedCreateInput> = {}) => {
  const user = await resetEmailRows();

  return prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: "worker-tests@example.com",
      senderName: "Worker Tests",
      recipientEmail: "recipient@example.com",
      subject: "Worker duplicate prevention",
      body: "Ensure duplicate sends are blocked.",
      scheduledAt: new Date(Date.now() + 60_000),
      status: "SCHEDULED",
      ...overrides
    }
  });
};

beforeEach(async () => {
  await resetEmailRows();
});

after(async () => {
  await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
});

test("claimScheduledEmailForProcessing is atomic across concurrent callers", async () => {
  const email = await createScheduledEmailRow();

  const [firstClaim, secondClaim] = await Promise.all([
    claimScheduledEmailForProcessing(email.id),
    claimScheduledEmailForProcessing(email.id)
  ]);

  const successfulClaims = [firstClaim, secondClaim].filter(Boolean);
  const persistedEmail = await getEmailById(email.id);

  assert.equal(successfulClaims.length, 1);
  assert.equal(persistedEmail?.status, "PROCESSING");
});

test("worker skips sending when the database email is already SENT", async () => {
  const email = await createScheduledEmailRow({
    status: "SENT",
    sentAt: new Date(),
    attempts: 1
  });
  let sendCount = 0;

  const processor = createEmailJobProcessor({
    sendEmail: async () => {
      sendCount += 1;
      return {
        messageId: "should-not-send"
      } as never;
    },
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  await processor({
    data: {
      emailId: email.id
    },
    attemptsMade: 0,
    opts: {
      attempts: 3
    }
  } as never);

  const persistedEmail = await getEmailById(email.id);

  assert.equal(sendCount, 0);
  assert.equal(persistedEmail?.status, "SENT");
  assert.equal(persistedEmail?.attempts, 1);
});

test("concurrent duplicate worker deliveries send the same email only once", async () => {
  const email = await createScheduledEmailRow({
    scheduledAt: new Date(Date.now() - 1_000)
  });
  let sendCount = 0;

  const processor = createEmailJobProcessor({
    reserveHourlyRateLimitSlot: async () => ({
      allowed: true,
      currentUsage: 1,
      limit: 100,
      hourWindow: "2026-08-20-10",
      key: "email-rate:test:2026-08-20-10"
    }),
    reserveNextSendSlot: async () => ({
      nowMs: Date.now(),
      reservedAtMs: Date.now(),
      nextWindowMs: Date.now(),
      waitMs: 0
    }),
    sleepFor: async () => undefined,
    sendEmail: async () => {
      sendCount += 1;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 25);
      });

      return {
        messageId: `sent-once-${sendCount}`
      } as never;
    },
    getEmailPreviewUrl: () => false,
    logger: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  });

  const duplicateJob = {
    data: {
      emailId: email.id
    },
    attemptsMade: 0,
    opts: {
      attempts: 3
    }
  } as const;

  await Promise.all([
    processor(duplicateJob as never),
    processor(duplicateJob as never)
  ]);

  const persistedEmail = await getEmailById(email.id);

  assert.equal(sendCount, 1);
  assert.equal(persistedEmail?.status, "SENT");
  assert.equal(persistedEmail?.attempts, 1);
});
