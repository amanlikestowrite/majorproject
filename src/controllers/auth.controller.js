const prisma = require("../../prisma/lib/prisma");
const googleAuthService = require("../services/google.service");
const SessionService = require("../services/session.service");
const config = require("../config/env");
const { hashPassword, verifyPassword } = require("../utils/crypto.util");

class AuthController {
  static async register(req, res, next) {
    try {
      const { email, password, name } = req.body || {};

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({
          status: "error",
          code: "INVALID_EMAIL",
          message: "A valid email address is required.",
        });
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          status: "error",
          code: "WEAK_PASSWORD",
          message: "Password must be at least 6 characters.",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        return res.status(409).json({
          status: "error",
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email address already exists.",
        });
      }

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name && typeof name === "string" ? name.trim() : null,
        },
      });

      const { authSession, rawToken } = await SessionService.createAuthSession(user.id);

      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
      };

      res.clearCookie("nyaya_guest_token", cookieOpts);
      res.cookie("nyaya_guest_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });

      res.cookie("nyaya_auth_token", rawToken, {
        ...cookieOpts,
        maxAge: config.authSessionTtlDays * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        status: "success",
        message: "Account created successfully.",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          session: {
            id: authSession.id,
            token: rawToken,
            expiresAt: authSession.expiresAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({
          status: "error",
          code: "MISSING_CREDENTIALS",
          message: "Email and password are required.",
        });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({
          status: "error",
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        });
      }

      const { authSession, rawToken } = await SessionService.createAuthSession(user.id);

      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
      };

      res.clearCookie("nyaya_guest_token", cookieOpts);
      res.cookie("nyaya_guest_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });

      res.cookie("nyaya_auth_token", rawToken, {
        ...cookieOpts,
        maxAge: config.authSessionTtlDays * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        status: "success",
        message: "Logged in successfully.",
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          session: {
            id: authSession.id,
            token: rawToken,
            expiresAt: authSession.expiresAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
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

      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
      };

      res.clearCookie("nyaya_guest_token", cookieOpts);
      res.cookie("nyaya_guest_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });

      res.cookie("nyaya_auth_token", rawToken, {
        ...cookieOpts,
        maxAge: config.authSessionTtlDays * 24 * 60 * 60 * 1000,
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
      return res.status(401).json({
        status: "error",
        code: "GOOGLE_AUTH_FAILED",
        message: err.message || "Failed to verify Google identity credentials.",
      });
    }
  }

  static async logout(req, res, next) {
    try {
      const rawToken = req.sessionToken;
      if (rawToken) {
        await SessionService.revokeAuthToken(rawToken);
      }

      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
      };

      res.clearCookie("nyaya_auth_token", cookieOpts);
      res.clearCookie("nyaya_guest_token", cookieOpts);
      res.cookie("nyaya_auth_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });
      res.cookie("nyaya_guest_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });

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
