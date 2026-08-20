import nodemailer from "nodemailer";
import { env } from "../config.js";

type SendEmailParams = {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const getTransporter = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be set for email sending.");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
};

export const sendEmail = async (params: SendEmailParams) => {
  if (!params.text && !params.html) {
    throw new Error("Email body must include text or html.");
  }

  const transporter = getTransporter();
  return transporter.sendMail(params);
};

export const getEmailPreviewUrl = (info: nodemailer.SentMessageInfo) =>
  nodemailer.getTestMessageUrl(info);
