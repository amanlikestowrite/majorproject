const config = require("../config/env");

function formatTimestamp() {
  return new Date().toISOString();
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  const cleaned = { ...meta };
  const sensitiveKeys = [
    "token", "sessionToken", "password", "idToken", "credential",
    "authorization", "cookie", "set-cookie", "internalSecret"
  ];

  for (const key of Object.keys(cleaned)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      cleaned[key] = "[REDACTED]";
    }
  }
  return cleaned;
}

const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({
      level: "INFO",
      timestamp: formatTimestamp(),
      message,
      ...sanitizeMeta(meta),
    }));
  },

  warn(message, meta = {}) {
    console.warn(JSON.stringify({
      level: "WARN",
      timestamp: formatTimestamp(),
      message,
      ...sanitizeMeta(meta),
    }));
  },

  error(message, error = null, meta = {}) {
    const errorDetails = error ? {
      errorMessage: error.message,
      errorCode: error.code || null,
      name: error.name || null,
      ...(config.nodeEnv === "development" ? { stack: error.stack } : {}),
    } : {};

    console.error(JSON.stringify({
      level: "ERROR",
      timestamp: formatTimestamp(),
      message,
      ...errorDetails,
      ...sanitizeMeta(meta),
    }));
  },
};

module.exports = logger;
