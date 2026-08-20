import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../prisma.js";
import { env } from "../config.js";
import { buildSessionForUser } from "./auth-session.service.js";

type GoogleUserProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

const oauthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

const googleScopes = ["openid", "email", "profile"];

const resolveGoogleProfileFromCode = async (code: string) => {
  const { tokens } = await oauthClient.getToken(code);

  if (!tokens.access_token) {
    throw new Error("Google did not return an access token.");
  }

  oauthClient.setCredentials(tokens);

  const profileResponse = await oauthClient.request<GoogleUserProfile>({
    url: "https://openidconnect.googleapis.com/v1/userinfo"
  });

  const profile = profileResponse.data;

  if (!profile.sub || !profile.email || !profile.email_verified) {
    throw new Error("Google did not return a verified user profile.");
  }

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    avatar: profile.picture ?? null
  };
};

const upsertGoogleUser = async (
  transaction: Prisma.TransactionClient,
  profile: Awaited<ReturnType<typeof resolveGoogleProfileFromCode>>
) => {
  const existingUser =
    (await transaction.user.findUnique({
      where: {
        googleId: profile.googleId
      }
    })) ??
    (await transaction.user.findUnique({
      where: {
        email: profile.email
      }
    }));

  if (existingUser) {
    return transaction.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar
      }
    });
  }

  return transaction.user.create({
    data: profile
  });
};

export const createGoogleAuthorizationRequest = () => {
  const state = randomBytes(24).toString("hex");

  return {
    state,
    url: oauthClient.generateAuthUrl({
      access_type: "online",
      include_granted_scopes: true,
      prompt: "select_account",
      scope: googleScopes,
      state
    })
  };
};

export const authenticateWithGoogleCallback = async (code: string) => {
  const profile = await resolveGoogleProfileFromCode(code);

  return prisma.$transaction(async (transaction) => {
    const user = await upsertGoogleUser(transaction, profile);
    const session = buildSessionForUser(user.id);

    await transaction.session.create({
      data: {
        userId: session.userId,
        sessionTokenHash: session.sessionTokenHash,
        expiresAt: session.expiresAt
      }
    });

    return {
      user,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt
    };
  });
};
