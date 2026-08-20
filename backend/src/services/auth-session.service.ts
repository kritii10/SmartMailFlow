import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { env } from "../config.js";

const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const buildSessionForUser = (userId: string) => {
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_MS);

  return {
    sessionToken,
    sessionTokenHash: hashSessionToken(sessionToken),
    expiresAt,
    userId
  };
};

export const getSessionFromToken = async (sessionToken: string) => {
  const session = await prisma.session.findUnique({
    where: {
      sessionTokenHash: hashSessionToken(sessionToken)
    },
    include: {
      user: true
    }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({
      where: {
        id: session.id
      }
    });

    return null;
  }

  return session;
};

export const invalidateSessionFromToken = async (sessionToken: string) =>
  prisma.session.deleteMany({
    where: {
      sessionTokenHash: hashSessionToken(sessionToken)
    }
  });
