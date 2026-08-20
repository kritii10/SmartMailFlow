import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "./app.js";
import { disconnectPrisma, prisma } from "./prisma.js";
import { closeQueueResources, emailQueue } from "./queue.js";
import { closeRedisConnections } from "./redis.js";
import { buildSessionForUser } from "./services/auth-session.service.js";
import { env } from "./config.js";

const TEST_USER_EMAIL = "app-integration-tests@reachinbox.local";

const startServer = async () =>
  new Promise<Server>((resolve) => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });

const stopServer = async (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const createAuthenticatedSessionCookie = async () => {
  const user = await prisma.user.upsert({
    where: {
      email: TEST_USER_EMAIL
    },
    update: {
      name: "App Integration Tests",
      googleId: "app-integration-tests-google"
    },
    create: {
      email: TEST_USER_EMAIL,
      name: "App Integration Tests",
      googleId: "app-integration-tests-google"
    }
  });

  const session = buildSessionForUser(user.id);

  await prisma.session.create({
    data: {
      userId: session.userId,
      sessionTokenHash: session.sessionTokenHash,
      expiresAt: session.expiresAt
    }
  });

  return {
    user,
    cookie: `${env.AUTH_COOKIE_NAME}=${session.sessionToken}`
  };
};

beforeEach(async () => {
  await emailQueue.obliterate({ force: true }).catch(() => undefined);

  const user = await prisma.user.upsert({
    where: {
      email: TEST_USER_EMAIL
    },
    update: {
      name: "App Integration Tests",
      googleId: "app-integration-tests-google"
    },
    create: {
      email: TEST_USER_EMAIL,
      name: "App Integration Tests",
      googleId: "app-integration-tests-google"
    }
  });

  await prisma.email.deleteMany({
    where: {
      userId: user.id
    }
  });

  await prisma.session.deleteMany({
    where: {
      userId: user.id
    }
  });
});

after(async () => {
  await Promise.allSettled([closeQueueResources(), closeRedisConnections(), disconnectPrisma()]);
});

test("requireAuth rejects unauthenticated requests and clears the session cookie", async () => {
  const server = await startServer();

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`);
    const body = (await response.json()) as { error: string };

    assert.equal(response.status, 401);
    assert.equal(body.error, "Authentication required.");
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`^${env.AUTH_COOKIE_NAME}=`));
  } finally {
    await stopServer(server);
  }
});

test("authenticated requests receive the current user profile", async () => {
  const server = await startServer();

  try {
    const address = server.address() as AddressInfo;
    const session = await createAuthenticatedSessionCookie();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: {
        Cookie: session.cookie
      }
    });
    const body = (await response.json()) as {
      data: {
        email: string;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.data.email, TEST_USER_EMAIL);
  } finally {
    await stopServer(server);
  }
});

test("schedule API validation rejects invalid payloads before any emails are created", async () => {
  const server = await startServer();

  try {
    const address = server.address() as AddressInfo;
    const session = await createAuthenticatedSessionCookie();
    const invalidPayload = {
      subject: "Validation test",
      body: "Reject duplicate recipients and past start time.",
      startTime: "2026-08-20T00:00:00.000Z",
      delayMs: 0,
      recipients: ["duplicate@example.com", "duplicate@example.com"]
    };

    const response = await fetch(`http://127.0.0.1:${address.port}/api/emails/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: session.cookie
      },
      body: JSON.stringify(invalidPayload)
    });
    const body = (await response.json()) as { error: string };
    const persistedCount = await prisma.email.count({
      where: {
        userId: session.user.id
      }
    });

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid email scheduling payload.");
    assert.equal(persistedCount, 0);
  } finally {
    await stopServer(server);
  }
});
