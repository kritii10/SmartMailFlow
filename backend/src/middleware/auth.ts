import { NextFunction, Request, Response } from "express";
import { env } from "../config.js";
import { getSessionFromToken } from "../services/auth-session.service.js";
import { clearSessionCookie, getCookie } from "../utils/cookies.js";
import { sendError } from "../utils/http.js";

const resolveRequestSession = async (request: Request) => {
  const sessionToken = getCookie(request.headers.cookie, env.AUTH_COOKIE_NAME);

  if (!sessionToken) {
    return null;
  }

  return getSessionFromToken(sessionToken);
};

export const requireAuth = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const session = await resolveRequestSession(request);

  if (!session) {
    response.setHeader("Set-Cookie", clearSessionCookie());
    return sendError(response, 401, "Authentication required.");
  }

  request.auth = {
    userId: session.user.id,
    email: session.user.email,
    sessionId: session.id
  };
  request.authUser = session.user;

  return next();
};

export const getSessionTokenFromRequest = (request: Request) =>
  getCookie(request.headers.cookie, env.AUTH_COOKIE_NAME);
