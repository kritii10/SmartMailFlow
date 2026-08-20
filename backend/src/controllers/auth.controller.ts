import { Request, Response } from "express";
import { env } from "../config.js";
import { getSessionTokenFromRequest } from "../middleware/auth.js";
import { invalidateSessionFromToken } from "../services/auth-session.service.js";
import {
  authenticateWithGoogleCallback,
  createGoogleAuthorizationRequest
} from "../services/google-auth.service.js";
import {
  createOauthStateCookie,
  createSessionCookie,
  clearOauthStateCookie,
  clearSessionCookie,
  getCookie
} from "../utils/cookies.js";
import { sendData, sendError } from "../utils/http.js";
import { googleAuthCallbackQuerySchema } from "../validators/auth.validator.js";

const buildFrontendRedirect = (params?: Record<string, string>) => {
  const url = new URL(env.FRONTEND_URL);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
};

export const startGoogleAuthController = (_request: Request, response: Response) => {
  const authRequest = createGoogleAuthorizationRequest();

  response.setHeader("Set-Cookie", createOauthStateCookie(authRequest.state));
  response.redirect(authRequest.url);
};

export const googleAuthCallbackController = async (request: Request, response: Response) => {
  const parsed = googleAuthCallbackQuerySchema.safeParse(request.query);
  const expectedState = getCookie(request.headers.cookie, env.OAUTH_STATE_COOKIE_NAME);

  if (!parsed.success || !expectedState || parsed.data.state !== expectedState) {
    response.setHeader("Set-Cookie", clearOauthStateCookie());
    return response.redirect(buildFrontendRedirect({ authError: "google_oauth_state_mismatch" }));
  }

  try {
    const authResult = await authenticateWithGoogleCallback(parsed.data.code);

    response.setHeader("Set-Cookie", [
      clearOauthStateCookie(),
      createSessionCookie(authResult.sessionToken, authResult.expiresAt)
    ]);

    return response.redirect(buildFrontendRedirect());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google authentication failed.";
    response.setHeader("Set-Cookie", [clearOauthStateCookie(), clearSessionCookie()]);
    return response.redirect(buildFrontendRedirect({ authError: message }));
  }
};

export const getCurrentUserController = (request: Request, response: Response) => {
  if (!request.authUser) {
    return sendError(response, 401, "Authentication required.");
  }

  return sendData(response, request.authUser);
};

export const logoutController = async (request: Request, response: Response) => {
  const sessionToken = getSessionTokenFromRequest(request);

  if (sessionToken) {
    await invalidateSessionFromToken(sessionToken);
  }

  response.setHeader("Set-Cookie", clearSessionCookie());
  return sendData(response, { success: true });
};
