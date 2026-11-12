class MemoryRateLimiter {
  constructor({ windowMs, max, message, code = "RATE_LIMIT_EXCEEDED" }) {
    this.windowMs = windowMs;
    this.max = max;
    this.message = message || "Too many requests. Please slow down and try again later.";
    this.code = code;
    this.hits = new Map();

    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, records] of this.hits.entries()) {
      const valid = records.filter(ts => ts > now - this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  reset() {
    this.hits.clear();
  }

  middleware() {
    return (req, res, next) => {
      const clientId =
        (req.user && req.user.id) ||
        (req.guestSession && req.guestSession.id) ||
        req.ip ||
        req.headers["x-forwarded-for"] ||
        "anonymous";

      const now = Date.now();
      const clientHits = (this.hits.get(clientId) || []).filter(ts => ts > now - this.windowMs);

      if (clientHits.length >= this.max) {
        const oldestHit = clientHits[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + this.windowMs - now) / 1000));

        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          status: "error",
          code: this.code,
          message: this.message,
          retryAfterSeconds,
        });
      }

      clientHits.push(now);
      this.hits.set(clientId, clientHits);
      next();
    };
  }
}

const authRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts. Please try again after a few minutes.",
  code: "AUTH_RATE_LIMIT_EXCEEDED",
});

const chatRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Chat request limit reached. Please wait before asking more questions.",
  code: "CHAT_RATE_LIMIT_EXCEEDED",
});

module.exports = {
  MemoryRateLimiter,
  authRateLimiter: authRateLimiter.middleware(),
  chatRateLimiter: chatRateLimiter.middleware(),
  _rawAuthLimiter: authRateLimiter,
  _rawChatLimiter: chatRateLimiter,
};
