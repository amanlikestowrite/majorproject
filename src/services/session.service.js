const prisma = require("../../prisma/lib/prisma");
const { generateSecureToken, hashToken } = require("../utils/crypto.util");
const config = require("../config/env");

const inMemoryUsers = new Map();
const inMemorySessions = new Map();
const inMemoryGuestSessions = new Map();

class SessionService {
  static getOrCreateInMemoryUser(profile) {
    const key = profile.googleSub || profile.email || "demo-citizen";
    if (!inMemoryUsers.has(key)) {
      inMemoryUsers.set(key, {
        id: "mem-user-" + (profile.googleSub || Math.random().toString(36).substring(2, 10)),
        googleSub: profile.googleSub,
        email: profile.email || "citizen@example.com",
        name: profile.name || "Citizen User",
        avatarUrl: profile.avatarUrl || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return inMemoryUsers.get(key);
  }

  static async createGuestSession() {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.guestSessionTtlHours * 60 * 60 * 1000);

    try {
      const guestSession = await prisma.guestSession.create({
        data: {
          sessionTokenHash: tokenHash,
          expiresAt,
          createdAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
      return { guestSession, rawToken };
    } catch (dbErr) {
      console.warn("Database unavailable during guest session creation, storing in memory:", dbErr.message);
      const guestSession = {
        id: "mem-guest-" + Math.random().toString(36).substring(2, 10),
        sessionTokenHash: tokenHash,
        expiresAt,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };
      inMemoryGuestSessions.set(tokenHash, guestSession);
      return { guestSession, rawToken };
    }
  }

  static async validateGuestToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return null;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    try {
      const session = await prisma.guestSession.findUnique({
        where: { sessionTokenHash: tokenHash },
      });

      if (session) {
        if (session.expiresAt <= now) {
          return null;
        }

        const timeSinceLastActivity = now.getTime() - new Date(session.lastActivityAt).getTime();
        if (timeSinceLastActivity > 5 * 60 * 1000) {
          prisma.guestSession.update({
            where: { id: session.id },
            data: { lastActivityAt: now },
          }).catch(() => {});
        }

        return session;
      }
    } catch (dbErr) {
      // Database not reachable
    }

    const memSession = inMemoryGuestSessions.get(tokenHash);
    if (memSession) {
      if (memSession.expiresAt <= now) return null;
      memSession.lastActivityAt = now;
      return memSession;
    }

    return null;
  }

  static async createAuthSession(userId, userObj = null) {
    if (!userId) throw new Error("userId is required to create an auth session");

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.authSessionTtlDays * 24 * 60 * 60 * 1000);

    try {
      const authSession = await prisma.authSession.create({
        data: {
          userId,
          sessionTokenHash: tokenHash,
          expiresAt,
          createdAt: new Date(),
        },
      });
      return { authSession, rawToken };
    } catch (dbErr) {
      console.warn("Database unavailable during auth session creation, storing in memory:", dbErr.message);
      const authSession = {
        id: "mem-auth-" + Math.random().toString(36).substring(2, 10),
        userId,
        sessionTokenHash: tokenHash,
        expiresAt,
        createdAt: new Date(),
        user: userObj || inMemoryUsers.get(userId) || null,
      };
      inMemorySessions.set(tokenHash, authSession);
      return { authSession, rawToken };
    }
  }

  static async validateAuthToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return null;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    try {
      const session = await prisma.authSession.findUnique({
        where: { sessionTokenHash: tokenHash },
        include: {
          user: true,
        },
      });

      if (session) {
        if (session.revokedAt !== null || session.expiresAt <= now) {
          return null;
        }
        return session;
      }
    } catch (dbErr) {
      // Database not reachable
    }

    const memSession = inMemorySessions.get(tokenHash);
    if (memSession) {
      if (memSession.revokedAt || memSession.expiresAt <= now) {
        return null;
      }
      return memSession;
    }

    return null;
  }

  static async revokeAuthToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return false;

    const tokenHash = hashToken(rawToken);
    try {
      const session = await prisma.authSession.findUnique({
        where: { sessionTokenHash: tokenHash },
      });

      if (session) {
        await prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return true;
      }
    } catch (dbErr) {
      // Database not reachable
    }

    const memSession = inMemorySessions.get(tokenHash);
    if (memSession) {
      memSession.revokedAt = new Date();
      return true;
    }

    return false;
  }
}

module.exports = SessionService;
