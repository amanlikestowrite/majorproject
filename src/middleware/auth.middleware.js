const SessionService = require("../services/session.service");

function extractToken(req, type = "auth") {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  if (type === "guest" && req.headers["x-guest-token"]) {
    return req.headers["x-guest-token"].trim();
  }
  if (type === "auth" && req.headers["x-auth-token"]) {
    return req.headers["x-auth-token"].trim();
  }

  if (req.cookies) {
    if (type === "guest" && req.cookies.nyaya_guest_token) {
      return req.cookies.nyaya_guest_token;
    }
    if (type === "auth" && req.cookies.nyaya_auth_token) {
      return req.cookies.nyaya_auth_token;
    }
  }

  return null;
}

async function requireAuth(req, res, next) {
  try {
    const rawToken = extractToken(req, "auth");
    if (!rawToken) {
      return res.status(401).json({
        status: "error",
        code: "AUTH_REQUIRED",
        message: "Authentication required to access this resource.",
      });
    }

    const session = await SessionService.validateAuthToken(rawToken);
    if (!session) {
      return res.status(401).json({
        status: "error",
        code: "SESSION_INVALID_OR_EXPIRED",
        message: "Your login session is invalid or has expired. Please sign in again.",
      });
    }

    req.user = session.user;
    req.authSession = session;
    req.sessionToken = rawToken;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireGuest(req, res, next) {
  try {
    const rawToken = extractToken(req, "guest") || extractToken(req, "auth");
    if (!rawToken) {
      return res.status(401).json({
        status: "error",
        code: "GUEST_SESSION_REQUIRED",
        message: "An active guest session token is required.",
      });
    }

    const session = await SessionService.validateGuestToken(rawToken);
    if (!session) {
      return res.status(401).json({
        status: "error",
        code: "GUEST_SESSION_EXPIRED",
        message: "Guest session has expired or is invalid. Please create a new guest session.",
      });
    }

    req.guestSession = session;
    req.sessionToken = rawToken;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAnySession(req, res, next) {
  try {
    const authToken = extractToken(req, "auth");
    if (authToken) {
      const authSession = await SessionService.validateAuthToken(authToken);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        return next();
      }
    }

    const guestToken = extractToken(req, "guest") || authToken;
    if (guestToken) {
      const guestSession = await SessionService.validateGuestToken(guestToken);
      if (guestSession) {
        req.guestSession = guestSession;
        return next();
      }
    }

    return res.status(401).json({
      status: "error",
      code: "SESSION_REQUIRED",
      message: "Valid session required. Please initialize a guest session or sign in.",
    });
  } catch (err) {
    next(err);
  }
}

async function optionalSession(req, res, next) {
  try {
    const authToken = extractToken(req, "auth");
    if (authToken) {
      const authSession = await SessionService.validateAuthToken(authToken);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        return next();
      }
    }

    const guestToken = extractToken(req, "guest") || authToken;
    if (guestToken) {
      const guestSession = await SessionService.validateGuestToken(guestToken);
      if (guestSession) {
        req.guestSession = guestSession;
        return next();
      }
    }

    next();
  } catch {
    next();
  }
}

module.exports = {
  extractToken,
  requireAuth,
  requireGuest,
  requireAnySession,
  optionalSession,
};
