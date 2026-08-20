import { randomUUID } from "node:crypto";
import { Email, Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { prisma } from "../prisma.js";
import { rescheduleEmailJob, scheduleEmailJob } from "./email-scheduler.service.js";

export type CreateEmailInput = {
  userId: string;
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
};

export const createScheduledEmail = async (input: CreateEmailInput) => {
  const email = await prisma.email.create({
    data: {
      userId: input.userId,
      senderEmail: input.senderEmail,
      senderName: input.senderName,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      idempotencyKey: randomUUID(),
      status: "SCHEDULED"
    }
  });

  return scheduleEmailJob(email);
};

type CsvLeadRow = {
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
};

export const createScheduledEmailsFromCsv = async (userId: string, csvContent: string) => {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvLeadRow[];

  if (records.length === 0) {
    throw new Error("CSV file did not contain any rows.");
  }

  const payloads: Prisma.EmailUncheckedCreateInput[] = records.map((record) => {
    const scheduledAt = new Date(record.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error(`Invalid scheduledAt value: ${record.scheduledAt}`);
    }

    return {
      userId,
      senderEmail: record.senderEmail,
      senderName: record.senderName,
      recipientEmail: record.recipientEmail,
      subject: record.subject,
      body: record.body,
      scheduledAt,
      idempotencyKey: randomUUID(),
      status: "SCHEDULED"
    };
  });

  const createdEmails = await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const emails: Awaited<ReturnType<typeof transaction.email.create>>[] = [];

    for (const payload of payloads) {
      const email = await transaction.email.create({
        data: payload
      });
      emails.push(email);
    }

    return emails;
  });

  return Promise.all(createdEmails.map((email) => scheduleEmailJob(email)));
};

export const listEmailsForUser = async (userId: string) => {
  return prisma.email.findMany({
    where: { userId },
    orderBy: {
      scheduledAt: "asc"
    }
  });
};

export const listSendersForUser = async (userId: string) => {
  const senderRows = await prisma.email.findMany({
    where: { userId },
    distinct: ["senderEmail"],
    select: {
      senderEmail: true,
      senderName: true
    },
    orderBy: {
      senderEmail: "asc"
    }
  });

  return senderRows;
};

export const listScheduledEmailsForUser = async (
  userId: string,
  page: number,
  pageSize: number
) => {
  const where = {
    userId,
    OR: [{ status: "SCHEDULED" as const }, { status: "PROCESSING" as const }]
  };

  const [total, emails] = await prisma.$transaction([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: [
        { scheduledAt: "asc" },
        { createdAt: "asc" }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return { total, emails };
};

export const listSentEmailsForUser = async (
  userId: string,
  page: number,
  pageSize: number
) => {
  const where = {
    userId,
    OR: [{ status: "SENT" as const }, { status: "FAILED" as const }]
  };

  const [total, emails] = await prisma.$transaction([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" }
      ],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return { total, emails };
};

export const getEmailForUser = async (emailId: string, userId: string) => {
  return prisma.email.findFirst({
    where: {
      id: emailId,
      userId
    }
  });
};

export const rescheduleEmail = async (
  emailId: string,
  scheduledAt: Date,
  errorMessage?: string | null
) => {
  const email = await prisma.email.update({
    where: { id: emailId },
    data: {
      status: "SCHEDULED",
      scheduledAt,
      lastError: errorMessage ?? null
    }
  });

  return rescheduleEmailJob(email);
};

export const getEmailById = async (emailId: string) => {
  return prisma.email.findUnique({
    where: { id: emailId }
  });
};

export const listRecoverableEmails = async () => {
  return prisma.email.findMany({
    where: {
      OR: [{ status: "SCHEDULED" }, { status: "PROCESSING" }]
    },
    orderBy: [
      { scheduledAt: "asc" },
      { createdAt: "asc" }
    ]
  });
};

export const updateEmailBullJobId = async (emailId: string, bullJobId: string) => {
  return prisma.email.update({
    where: {
      id: emailId
    },
    data: {
      bullJobId
    }
  });
};

export const claimScheduledEmailForProcessing = async (emailId: string) => {
  const result = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: "SCHEDULED"
    },
    data: {
      status: "PROCESSING",
      failedAt: null,
      lastError: null
    }
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.email.findUnique({
    where: { id: emailId }
  });
};

export const incrementEmailAttempts = async (emailId: string) => {
  await prisma.email.updateMany({
    where: {
      id: emailId,
      status: "PROCESSING"
    },
    data: {
      attempts: {
        increment: 1
      }
    }
  });
};

export const markEmailSent = async (emailId: string) => {
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      failedAt: null,
      lastError: null
    }
  });
};

export const markEmailRetryableFailure = async (emailId: string, errorMessage: string) => {
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: "SCHEDULED",
      failedAt: null,
      lastError: errorMessage
    }
  });
};

export const markEmailFailed = async (emailId: string, errorMessage: string) => {
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      lastError: errorMessage
    }
  });
};

export const rescheduleProcessingEmail = async (
  emailId: string,
  scheduledAt: Date,
  errorMessage?: string | null
) => {
  await prisma.email.updateMany({
    where: {
      id: emailId,
      status: "PROCESSING"
    },
    data: {
      status: "SCHEDULED",
      scheduledAt,
      failedAt: null,
      lastError: errorMessage ?? null
    }
  });
};

export type RecoverableEmail = Pick<
  Email,
  "id" | "status" | "scheduledAt" | "bullJobId" | "createdAt" | "updatedAt"
>;
