import { z } from "zod";
import { env } from "../config.js";

export const createEmailSchema = z.object({
  senderEmail: z.string().email(),
  senderName: z.string().min(1).max(100).optional(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  scheduledAt: z.string().datetime()
});

export const csvUploadSchema = z.object({
  csvContent: z.string().min(1)
});

const uniqueRecipients = (recipients: string[]) =>
  new Set(recipients.map((recipient) => recipient.toLowerCase())).size === recipients.length;

export const scheduleEmailsSchema = z
  .object({
    senderEmail: z.string().trim().email().optional(),
    senderName: z.string().trim().min(1).max(100).optional(),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    startTime: z.string().datetime(),
    delayMs: z.coerce.number().int().min(0).max(86_400_000),
    hourlyLimit: z.coerce.number().int().positive().max(env.MAX_EMAILS_PER_HOUR).optional(),
    recipients: z
      .array(z.string().trim().email())
      .min(1)
      .max(500)
      .refine(uniqueRecipients, "Recipients must be unique.")
  })
  .superRefine((value, context) => {
    const startTime = new Date(value.startTime);

    if (Number.isNaN(startTime.getTime()) || startTime.getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "startTime must be a valid future ISO datetime."
      });
    }
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});
