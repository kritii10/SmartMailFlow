import { Request, Response } from "express";
import {
  createScheduledEmail,
  createScheduledEmailsFromCsv,
  getEmailForUser,
  listEmailsForUser,
  listScheduledEmailsForUser,
  listSendersForUser,
  listSentEmailsForUser
} from "../services/email.service.js";
import { scheduleEmailBatch } from "../services/scheduler.service.js";
import {
  createEmailSchema,
  csvUploadSchema,
  paginationQuerySchema,
  scheduleEmailsSchema
} from "../validators/email.validator.js";
import { sendData, sendError, sendPaginated } from "../utils/http.js";

export const createEmailController = async (request: Request, response: Response) => {
  const parsed = createEmailSchema.safeParse(request.body);

  if (!parsed.success || !request.auth) {
    return sendError(response, 400, "Invalid email scheduling payload.");
  }

  try {
    const email = await createScheduledEmail({
      userId: request.auth.userId,
      ...parsed.data,
      scheduledAt: new Date(parsed.data.scheduledAt)
    });

    return sendData(response, email, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to schedule email.";
    return sendError(response, 500, message);
  }
};

export const createEmailsFromCsvController = async (request: Request, response: Response) => {
  const parsed = csvUploadSchema.safeParse(request.body);

  if (!parsed.success || !request.auth) {
    return sendError(response, 400, "Invalid CSV upload payload.");
  }

  try {
    const emails = await createScheduledEmailsFromCsv(request.auth.userId, parsed.data.csvContent);
    return sendData(
      response,
      {
      createdCount: emails.length,
      emails
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import CSV leads.";
    return sendError(response, 400, message);
  }
};

export const listEmailsController = async (request: Request, response: Response) => {
  if (!request.auth) {
    return sendError(response, 401, "Authentication required.");
  }

  const emails = await listEmailsForUser(request.auth.userId);
  return sendData(response, emails);
};

export const listSendersController = async (request: Request, response: Response) => {
  if (!request.auth) {
    return sendError(response, 401, "Authentication required.");
  }

  const senders = await listSendersForUser(request.auth.userId);
  return sendData(response, senders);
};

export const scheduleEmailsController = async (request: Request, response: Response) => {
  const parsed = scheduleEmailsSchema.safeParse(request.body);

  if (!parsed.success || !request.auth) {
    return sendError(response, 400, "Invalid email scheduling payload.");
  }

  try {
    const result = await scheduleEmailBatch({
      userId: request.auth.userId,
      senderEmail: parsed.data.senderEmail,
      senderName: parsed.data.senderName,
      subject: parsed.data.subject,
      body: parsed.data.body,
      startTime: new Date(parsed.data.startTime),
      delayMs: parsed.data.delayMs,
      hourlyLimit: parsed.data.hourlyLimit,
      recipients: parsed.data.recipients
    });

    return sendData(response, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to schedule emails.";
    return sendError(response, 500, message);
  }
};

export const listScheduledEmailsController = async (request: Request, response: Response) => {
  const parsedQuery = paginationQuerySchema.safeParse(request.query);

  if (!parsedQuery.success || !request.auth) {
    return sendError(response, 400, "Invalid pagination query.");
  }

  const result = await listScheduledEmailsForUser(
    request.auth.userId,
    parsedQuery.data.page,
    parsedQuery.data.pageSize
  );

  return sendPaginated(response, {
    data: result.emails,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
    total: result.total
  });
};

export const listSentEmailsController = async (request: Request, response: Response) => {
  const parsedQuery = paginationQuerySchema.safeParse(request.query);

  if (!parsedQuery.success || !request.auth) {
    return sendError(response, 400, "Invalid pagination query.");
  }

  const result = await listSentEmailsForUser(
    request.auth.userId,
    parsedQuery.data.page,
    parsedQuery.data.pageSize
  );

  return sendPaginated(response, {
    data: result.emails,
    page: parsedQuery.data.page,
    pageSize: parsedQuery.data.pageSize,
    total: result.total
  });
};

export const getEmailController = async (request: Request, response: Response) => {
  if (!request.auth) {
    return sendError(response, 401, "Authentication required.");
  }

  const emailId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const email = await getEmailForUser(emailId, request.auth.userId);

  if (!email) {
    return sendError(response, 404, "Email not found.");
  }

  return sendData(response, email);
};
