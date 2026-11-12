const prisma = require("../../prisma/lib/prisma");
const googleAuthService = require("../services/google.service");
const SessionService = require("../services/session.service");
const config = require("../config/env");

class AuthController {
  static async googleLogin(req, res, next) {
    try {
      const idToken = req.idToken;
      const verifiedProfile = await googleAuthService.verifyIdToken(idToken);

      let user = null;
      try {
        user = await prisma.user.findUnique({
          where: { googleSub: verifiedProfile.googleSub },
        });

        if (!user) {
          if (verifiedProfile.email) {
            const existingByEmail = await prisma.user.findUnique({
              where: { email: verifiedProfile.email },
            });

            if (existingByEmail) {
              user = await prisma.user.update({
                where: { id: existingByEmail.id },
                data: {
                  googleSub: verifiedProfile.googleSub,
                  name: verifiedProfile.name || existingByEmail.name,
                  avatarUrl: verifiedProfile.avatarUrl || existingByEmail.avatarUrl,
                },
              });
            }
          }

          if (!user) {
            user = await prisma.user.create({
              data: {
                googleSub: verifiedProfile.googleSub,
                email: verifiedProfile.email,
                name: verifiedProfile.name,
                avatarUrl: verifiedProfile.avatarUrl,
              },
            });
          }
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              name: verifiedProfile.name || user.name,
              avatarUrl: verifiedProfile.avatarUrl || user.avatarUrl,
              email: verifiedProfile.email || user.email,
            },
          });
        }
      } catch (dbErr) {
        console.warn("Database unavailable during user lookup/create, using in-memory store:", dbErr.message);
        user = SessionService.getOrCreateInMemoryUser(verifiedProfile);
      }

      const { authSession, rawToken } = await SessionService.createAuthSession(user.id, user);

      res.cookie("nyaya_auth_token", rawToken, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: config.authSessionTtlDays * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
          },
          session: {
            id: authSession.id,
            token: rawToken,
            expiresAt: authSession.expiresAt,
          },
        },
      });
    } catch (err) {
      if (err.message && err.message.includes("Google")) {
        return res.status(401).json({
          status: "error",
          code: "GOOGLE_AUTH_FAILED",
          message: "Failed to verify Google identity credentials.",
        });
      }
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const rawToken = req.sessionToken;
      if (rawToken) {
        await SessionService.revokeAuthToken(rawToken);
      }

      res.clearCookie("nyaya_auth_token", { path: "/" });

      return res.status(200).json({
        status: "success",
        message: "Successfully logged out.",
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCurrentUser(req, res) {
    const user = req.user;
    return res.status(200).json({
      status: "success",
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }
}

module.exports = AuthController;
