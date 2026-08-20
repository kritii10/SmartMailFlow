import { Router } from "express";
import {
  createEmailController,
  createEmailsFromCsvController,
  getEmailController,
  listEmailsController,
  listScheduledEmailsController,
  listSendersController,
  listSentEmailsController,
  scheduleEmailsController
} from "../controllers/email.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const emailRouter = Router();

emailRouter.use(requireAuth);
emailRouter.get("/scheduled", listScheduledEmailsController);
emailRouter.get("/sent", listSentEmailsController);
emailRouter.get("/", listEmailsController);
emailRouter.get("/senders", listSendersController);
emailRouter.get("/:id", getEmailController);
emailRouter.post("/schedule", scheduleEmailsController);
emailRouter.post("/", createEmailController);
emailRouter.post("/upload-csv", createEmailsFromCsvController);
