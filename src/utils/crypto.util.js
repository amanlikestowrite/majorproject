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

function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new TypeError("Password must be a non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password, storedCombinedHash) {
  if (!password || !storedCombinedHash || typeof storedCombinedHash !== "string") {
    return false;
  }
  const parts = storedCombinedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

module.exports = {
  generateSecureToken,
  hashToken,
  hashPassword,
  verifyPassword,
};
