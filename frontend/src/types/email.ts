export type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";

export type EmailRecord = {
  id: string;
  senderEmail: string;
  senderName: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  status: EmailStatus;
  createdAt: string;
};

export type ScheduleEmailsRequest = {
  senderEmail?: string;
  senderName?: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit?: number;
  recipients: string[];
};

export type ScheduleEmailsResponse = {
  createdCount: number;
  senderEmail: string;
  senderName: string;
  hourlyLimitApplied: number;
  delayMs: number;
  startTime: string;
  emails: EmailRecord[];
};
