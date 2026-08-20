import { env, isSecureCookieEnabled } from "../config.js";

type CookieOptions = {
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
};

const encodeCookieValue = (value: string) => encodeURIComponent(value);

export const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return cookieHeader.split(";").reduce((cookies, entry) => {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex < 0) {
      return cookies;
    }

    const name = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();

    cookies.set(name, decodeURIComponent(value));
    return cookies;
  }, new Map<string, string>());
};

export const getCookie = (cookieHeader: string | undefined, name: string) =>
  parseCookies(cookieHeader).get(name);

export const serializeCookie = (name: string, value: string, options: CookieOptions = {}) => {
  const parts = [`${name}=${encodeCookieValue(value)}`];

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly ?? true) {
    parts.push("HttpOnly");
  }

  parts.push(`SameSite=${options.sameSite ?? env.COOKIE_SAME_SITE}`);

  if (options.secure ?? isSecureCookieEnabled) {
    parts.push("Secure");
  }

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join("; ");
};

export const createSessionCookie = (token: string, expiresAt: Date) =>
  serializeCookie(env.AUTH_COOKIE_NAME, token, {
    expires: expiresAt,
    maxAge: expiresAt.getTime() - Date.now()
  });

export const clearSessionCookie = () =>
  serializeCookie(env.AUTH_COOKIE_NAME, "", {
    expires: new Date(0),
    maxAge: 0
  });

export const createOauthStateCookie = (state: string) =>
  serializeCookie(env.OAUTH_STATE_COOKIE_NAME, state, {
    maxAge: env.OAUTH_STATE_TTL_MS
  });

export const clearOauthStateCookie = () =>
  serializeCookie(env.OAUTH_STATE_COOKIE_NAME, "", {
    expires: new Date(0),
    maxAge: 0
  });
