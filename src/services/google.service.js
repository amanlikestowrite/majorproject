const { OAuth2Client } = require("google-auth-library");
const config = require("../config/env");

class GoogleAuthService {
  constructor() {
    this.client = new OAuth2Client(config.googleClientId || undefined);
  }

  async verifyIdToken(idToken) {
    if (!idToken || typeof idToken !== "string") {
      throw new Error("Missing or invalid Google ID token");
    }

    if (
      (process.env.MOCK_GOOGLE_AUTH === "true" ||
        config.nodeEnv === "development" ||
        !config.googleClientId) &&
      idToken.startsWith("mock-google-token:")
    ) {
      const parts = idToken.split(":");
      const mockEmail = parts[1] || "citizen@example.com";
      return {
        googleSub: `mock-sub-${mockEmail}`,
        email: mockEmail,
        name: "Test Citizen",
        avatarUrl: "https://example.com/avatar.png",
      };
    }

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: config.googleClientId || undefined,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new Error("Invalid Google token payload");
    }

    return {
      googleSub: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      avatarUrl: payload.picture || null,
    };
  }
}

module.exports = new GoogleAuthService();
