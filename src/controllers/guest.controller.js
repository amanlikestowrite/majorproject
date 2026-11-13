const SessionService = require("../services/session.service");
const config = require("../config/env");

class GuestController {
  static async createSession(req, res, next) {
    try {
      const { guestSession, rawToken } = await SessionService.createGuestSession();

      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
      };

      res.clearCookie("nyaya_auth_token", cookieOpts);
      res.cookie("nyaya_auth_token", "", { ...cookieOpts, expires: new Date(0), maxAge: 0 });

      res.cookie("nyaya_guest_token", rawToken, {
        ...cookieOpts,
        maxAge: config.guestSessionTtlHours * 60 * 60 * 1000,
      });

      return res.status(201).json({
        status: "success",
        data: {
          sessionId: guestSession.id,
          token: rawToken,
          expiresAt: guestSession.expiresAt,
          createdAt: guestSession.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async validateSession(req, res) {
    const session = req.guestSession;
    return res.status(200).json({
      status: "success",
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        lastActivityAt: session.lastActivityAt,
        active: true,
      },
    });
  }
}

module.exports = GuestController;
