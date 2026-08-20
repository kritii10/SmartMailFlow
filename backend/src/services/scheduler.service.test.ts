import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { disconnectPrisma, prisma } from "../prisma.js";
import { closeQueueResources, emailQueue } from "../queue.js";
import { closeRedisConnections } from "../redis.js";
import { enqueueEmailJob, buildRecipientSchedulePlan, scheduleEmailBatch } from "./scheduler.service.js";

const TEST_USER_EMAIL = "scheduler-service-tests@reachinbox.local";

const resetQueueAndData = async () => {
  await emailQueue.obliterate({ force: true }).catch(() => undefined);

  const user = await prisma.user.upsert({
    where: {
      email: TEST_USER_EMAIL
    },
    update: {
      name: "Scheduler Service Tests",
      googleId: "scheduler-service-tests-google"
    },
    create: {
      email: TEST_USER_EMAIL,
      name: "Scheduler Service Tests",
      googleId: "scheduler-service-tests-google"
    }
  });

  await prisma.email.deleteMany({
    where: {
      userId: user.id
    }
  });

  return user;
};

beforeEach(async () => {
  await resetQueueAndData();
});

after(async () => {
  await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
});

test("buildRecipientSchedulePlan rolls excess emails into the next hour window", () => {
  const startTime = new Date("2026-08-20T10:00:00.000Z");
  const recipients = ["one@example.com", "two@example.com", "three@example.com"];

  const plan = buildRecipientSchedulePlan(startTime, 0, recipients, 2);

  assert.deepEqual(
    plan.map((entry) => entry.scheduledAt.toISOString()),
    [
      "2026-08-20T10:00:00.000Z",
      "2026-08-20T10:00:00.000Z",
      "2026-08-20T11:00:00.000Z"
    ]
  );
});

test("enqueueEmailJob uses the database email id as a stable BullMQ job identity", async () => {
  const user = await resetQueueAndData();
  const scheduledAt = new Date(Date.now() + 60_000);

  const email = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: "stable-job-id@example.com",
      senderName: "Stable Job",
      recipientEmail: "recipient@example.com",
      subject: "Stable BullMQ identity",
      body: "Verify duplicate queue insertion is avoided.",
      scheduledAt,
      status: "SCHEDULED"
    }
  });

  const firstEnqueue = await enqueueEmailJob(email);
  const secondEnqueue = await enqueueEmailJob(email);
  const delayedJobs = await emailQueue.getJobs(["delayed"], 0, -1, true);

  assert.equal(firstEnqueue.bullJobId, email.id);
  assert.equal(secondEnqueue.bullJobId, email.id);
  assert.equal(delayedJobs.length, 1);
  assert.equal(`${delayedJobs[0]?.id ?? ""}`, email.id);
});

test("scheduleEmailBatch creates database rows and delayed jobs without duplicates", async () => {
  const user = await resetQueueAndData();
  const recipientCount = 105;
  const recipients = Array.from({ length: recipientCount }, (_, index) => `recipient-${index + 1}@example.com`);
  const startTime = new Date(Date.now() + 5 * 60 * 1000);

  const result = await scheduleEmailBatch({
    userId: user.id,
    subject: "Scheduler integration batch",
    body: "This batch validates DB rows and BullMQ delayed jobs.",
    startTime,
    delayMs: 0,
    hourlyLimit: 100,
    recipients
  });

  const persistedEmails = await prisma.email.findMany({
    where: {
      userId: user.id
    },
    orderBy: {
      scheduledAt: "asc"
    }
  });
  const delayedJobs = await emailQueue.getJobs(["delayed"], 0, -1, true);
  const uniqueIdempotencyKeys = new Set(persistedEmails.map((email) => email.idempotencyKey));
  const uniqueBullJobIds = new Set(
    persistedEmails.map((email) => email.bullJobId).filter((value): value is string => Boolean(value))
  );
  const firstWindowCount = persistedEmails.filter(
    (email) => email.scheduledAt.toISOString() === startTime.toISOString()
  ).length;
  const nextHourIso = new Date(startTime);
  nextHourIso.setUTCMinutes(0, 0, 0);
  nextHourIso.setUTCHours(nextHourIso.getUTCHours() + 1);
  const nextHourCount = persistedEmails.filter(
    (email) => email.scheduledAt.toISOString() === nextHourIso.toISOString()
  ).length;

  assert.equal(result.createdCount, recipientCount);
  assert.equal(persistedEmails.length, recipientCount);
  assert.equal(delayedJobs.length, recipientCount);
  assert.equal(uniqueIdempotencyKeys.size, recipientCount);
  assert.equal(uniqueBullJobIds.size, recipientCount);
  assert.equal(firstWindowCount, 100);
  assert.equal(nextHourCount, 5);
  assert.deepEqual(
    new Set(delayedJobs.map((job) => `${job.id ?? ""}`)),
    new Set(persistedEmails.map((email) => email.id))
  );
});

test("scheduleEmailBatch honors an explicit sender identity for the whole batch", async () => {
  const user = await resetQueueAndData();
  const startTime = new Date(Date.now() + 5 * 60 * 1000);

  const result = await scheduleEmailBatch({
    userId: user.id,
    senderEmail: "campaign-owner@example.com",
    senderName: "Campaign Owner",
    subject: "Sender override",
    body: "Use a non-default sender for this batch.",
    startTime,
    delayMs: 1000,
    recipients: ["override@example.com"]
  });

  const persistedEmail = await prisma.email.findUnique({
    where: {
      id: result.emails[0]?.id
    }
  });

  assert.equal(result.senderEmail, "campaign-owner@example.com");
  assert.equal(result.senderName, "Campaign Owner");
  assert.equal(persistedEmail?.senderEmail, "campaign-owner@example.com");
  assert.equal(persistedEmail?.senderName, "Campaign Owner");
});
