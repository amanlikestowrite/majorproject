require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  aiServiceUrl: (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/+$/, ""),
  internalAiSecret: process.env.INTERNAL_AI_SECRET || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "*",
  guestSessionTtlHours: parseInt(process.env.GUEST_SESSION_TTL_HOURS, 10) || 24,
  authSessionTtlDays: parseInt(process.env.AUTH_SESSION_TTL_DAYS, 10) || 7,
  rateLimitAuthWindowMs: 15 * 60 * 1000,
  rateLimitAuthMax: 30,
  rateLimitChatWindowMs: 15 * 60 * 1000,
  rateLimitChatMax: 100,
};

module.exports = config;
