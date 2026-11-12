const SessionService = require("../services/session.service");
const config = require("../config/env");

class GuestController {
  static async createSession(req, res, next) {
    try {
      const { guestSession, rawToken } = await SessionService.createGuestSession();

      res.cookie("nyaya_guest_token", rawToken, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: config.guestSessionTtlHours * 60 * 60 * 1000,
        path: "/",
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
