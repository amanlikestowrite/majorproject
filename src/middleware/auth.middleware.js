const SessionService = require("../services/session.service");
const { hashToken } = require("../utils/crypto.util");

function extractToken(req, type = "auth") {
  if (type === "guest") {
    if (req.headers["x-guest-token"]) {
      return req.headers["x-guest-token"].trim();
    }
    // If request explicitly carries user auth token, do NOT treat Authorization header as guest
    if (req.headers["x-auth-token"]) {
      return null;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
    if (req.cookies && req.cookies.nyaya_guest_token && !req.cookies.nyaya_auth_token) {
      return req.cookies.nyaya_guest_token;
    }
    return null;
  }

  // type === "auth"
  // If request explicitly carries guest token, do NOT extract any auth token
  if (req.headers["x-guest-token"] || (req.cookies && req.cookies.nyaya_guest_token && !req.headers["x-auth-token"])) {
    return null;
  }
  if (req.headers["x-auth-token"]) {
    return req.headers["x-auth-token"].trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies.nyaya_auth_token) {
    return req.cookies.nyaya_auth_token;
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
    req.guestSession = null;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireGuest(req, res, next) {
  try {
    const rawToken = extractToken(req, "guest");
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
    req.user = null;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAnySession(req, res, next) {
  try {
    // 1. Explicit guest request: prioritize guest session exclusively
    if (req.headers["x-guest-token"]) {
      const guestToken = req.headers["x-guest-token"].trim();
      let guestSession = await SessionService.validateGuestToken(guestToken);
      if (!guestSession) {
        // Create an ephemeral guest session for unpersisted/local guest token so it is strictly isolated
        guestSession = {
          id: "ephemeral-guest-" + hashToken(guestToken).substring(0, 16),
          sessionTokenHash: hashToken(guestToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          lastActivityAt: new Date(),
        };
      }
      req.guestSession = guestSession;
      req.sessionToken = guestToken;
      req.user = null;
      req.authSession = null;
      return next();
    }

    // 2. Explicit user auth request: prioritize user session exclusively
    if (req.headers["x-auth-token"]) {
      const authToken = req.headers["x-auth-token"].trim();
      const authSession = await SessionService.validateAuthToken(authToken);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        req.sessionToken = authToken;
        req.guestSession = null;
        return next();
      }
    }

    // 3. Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      // Try guest first if request is explicitly guest-oriented
      if (!req.headers["x-auth-token"]) {
        const guestSession = await SessionService.validateGuestToken(token);
        if (guestSession) {
          req.guestSession = guestSession;
          req.sessionToken = token;
          req.user = null;
          return next();
        }
      }
      const authSession = await SessionService.validateAuthToken(token);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        req.sessionToken = token;
        req.guestSession = null;
        return next();
      }
    }

    // 4. Cookies fallback
    if (req.cookies) {
      if (req.cookies.nyaya_guest_token && !req.headers["x-auth-token"]) {
        let guestSession = await SessionService.validateGuestToken(req.cookies.nyaya_guest_token);
        if (!guestSession) {
          guestSession = {
            id: "ephemeral-guest-" + hashToken(req.cookies.nyaya_guest_token).substring(0, 16),
            sessionTokenHash: hashToken(req.cookies.nyaya_guest_token),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            lastActivityAt: new Date(),
          };
        }
        req.guestSession = guestSession;
        req.sessionToken = req.cookies.nyaya_guest_token;
        req.user = null;
        req.authSession = null;
        return next();
      }
      if (req.cookies.nyaya_auth_token && !req.headers["x-guest-token"]) {
        const authSession = await SessionService.validateAuthToken(req.cookies.nyaya_auth_token);
        if (authSession) {
          req.user = authSession.user;
          req.authSession = authSession;
          req.sessionToken = req.cookies.nyaya_auth_token;
          req.guestSession = null;
          return next();
        }
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
    // 1. Explicit guest request: prioritize guest session exclusively
    if (req.headers["x-guest-token"]) {
      const guestToken = req.headers["x-guest-token"].trim();
      const guestSession = await SessionService.validateGuestToken(guestToken);
      if (guestSession) {
        req.guestSession = guestSession;
        req.sessionToken = guestToken;
        req.user = null;
        return next();
      }
    }

    // 2. Explicit user auth request: prioritize user session exclusively
    if (req.headers["x-auth-token"]) {
      const authToken = req.headers["x-auth-token"].trim();
      const authSession = await SessionService.validateAuthToken(authToken);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        req.sessionToken = authToken;
        req.guestSession = null;
        return next();
      }
    }

    // 3. Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const guestSession = await SessionService.validateGuestToken(token);
      if (guestSession) {
        req.guestSession = guestSession;
        req.sessionToken = token;
        req.user = null;
        return next();
      }
      const authSession = await SessionService.validateAuthToken(token);
      if (authSession) {
        req.user = authSession.user;
        req.authSession = authSession;
        req.sessionToken = token;
        req.guestSession = null;
        return next();
      }
    }

    // 4. Cookies fallback
    if (req.cookies) {
      if (req.cookies.nyaya_guest_token && !req.cookies.nyaya_auth_token) {
        const guestSession = await SessionService.validateGuestToken(req.cookies.nyaya_guest_token);
        if (guestSession) {
          req.guestSession = guestSession;
          req.sessionToken = req.cookies.nyaya_guest_token;
          req.user = null;
          return next();
        }
      }
      if (req.cookies.nyaya_auth_token) {
        const authSession = await SessionService.validateAuthToken(req.cookies.nyaya_auth_token);
        if (authSession) {
          req.user = authSession.user;
          req.authSession = authSession;
          req.sessionToken = req.cookies.nyaya_auth_token;
          req.guestSession = null;
          return next();
        }
      }
      if (req.cookies.nyaya_guest_token) {
        const guestSession = await SessionService.validateGuestToken(req.cookies.nyaya_guest_token);
        if (guestSession) {
          req.guestSession = guestSession;
          req.sessionToken = req.cookies.nyaya_guest_token;
          req.user = null;
          return next();
        }
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
