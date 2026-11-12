const crypto = require("crypto");

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token) {
  if (!token || typeof token !== "string") {
    throw new TypeError("Token must be a non-empty string");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  generateSecureToken,
  hashToken,
};
