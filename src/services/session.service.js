const prisma = require("../../prisma/lib/prisma");
const { generateSecureToken, hashToken } = require("../utils/crypto.util");
const config = require("../config/env");

class SessionService {
  static async createGuestSession() {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + config.guestSessionTtlHours * 60 * 60 * 1000);

    const guestSession = await prisma.guestSession.create({
      data: {
        sessionTokenHash: tokenHash,
        expiresAt,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    return { guestSession, rawToken };
  }

  static async validateGuestToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return null;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const session = await prisma.guestSession.findUnique({
      where: { sessionTokenHash: tokenHash },
    });

    if (!session) return null;

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

  static async createAuthSession(userId) {
    if (!userId) throw new Error("userId is required to create an auth session");

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + config.authSessionTtlDays * 24 * 60 * 60 * 1000);

    const authSession = await prisma.authSession.create({
      data: {
        userId,
        sessionTokenHash: tokenHash,
        expiresAt,
        createdAt: new Date(),
      },
    });

    return { authSession, rawToken };
  }

  static async validateAuthToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return null;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const session = await prisma.authSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: true,
      },
    });

    if (!session) return null;

    if (session.revokedAt !== null || session.expiresAt <= now) {
      return null;
    }

    return session;
  }

  static async revokeAuthToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") return false;

    const tokenHash = hashToken(rawToken);
    const session = await prisma.authSession.findUnique({
      where: { sessionTokenHash: tokenHash },
    });

    if (!session) return false;

    await prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return true;
  }
}

module.exports = SessionService;
