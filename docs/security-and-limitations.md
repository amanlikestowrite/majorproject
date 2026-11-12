# Nyaya Sahayak — Security Considerations & Known Limitations

**Module:** Express Application Gateway Integration  
**Date:** November 2026  

---

## 1. Security Architecture & Controls

### A. Session Token Cryptography
- **Entropy:** Tokens are generated using Node.js `crypto.randomBytes(32)` providing 256 bits of cryptographic entropy.
- **Hashing at Rest:** Plaintext session tokens are never stored in PostgreSQL. Only the SHA-256 hex digest (`sessionTokenHash`) is persisted in `AuthSession` and `GuestSession` tables.
- **Timing Safe Lookups:** Database lookups search for matching SHA-256 hashes against unique indexes, preventing token enumeration.

### B. Exclusive Ownership & Tenant Isolation
- **Conversation Ownership Constraint:**
  A conversation is strictly bounded:
  ```sql
  CHECK (
      ("userId" IS NOT NULL AND "guestSessionId" IS NULL) OR 
      ("userId" IS NULL AND "guestSessionId" IS NOT NULL)
  );
  ```
- **Access Control:** Every conversation operation (`GET /:id`, `DELETE /:id`, `POST /chat` with `conversationId`) checks that `conversation.userId === req.user.id` or `conversation.guestSessionId === req.guestSession.id`. Unmatched requests trigger immediate `403 Forbidden` (`CONVERSATION_ACCESS_DENIED`).

### C. Google OAuth Token Verification
- **Server-Side Cryptographic Verification:** Express verifies Google ID tokens using Google's public JSON Web Key Sets (JWKS) via `google-auth-library`.
- **Identity Trust:** Browser-supplied email addresses, names, or user IDs are strictly ignored. Only verified payload claims (`sub`, `email`, `name`, `picture`) from Google are accepted.

### D. Rate Limiting & Denial of Service Protection
- **Sliding-Window Memory Limiter:**
  - Authentication endpoints: 30 requests / 15 minutes per IP.
  - Chat endpoints: 100 requests / 15 minutes per IP/session.
  - Returns `429 Too Many Requests` with standard `Retry-After` header.

### E. Error Sanitization & PII Protection
- **Stack Trace Suppression:** In production, internal stack traces and database error codes are stripped from responses; clients receive consistent, human-readable error JSON.
- **Operational Log Sanitization:** Passwords, session tokens, Google credentials, and authorization headers are scrubbed (`[REDACTED]`) before logging.

---

## 2. Known Limitations & Production Recommendations

1. **In-Memory Rate Limiting:**
   - *Current Implementation:* In-memory sliding window map (`MemoryRateLimiter`).
   - *Limitation:* State is local to the Node.js process. In multi-instance clustered or serverless deployments, rate limiting should be backed by Redis (`ioredis` / `express-rate-limit` with RedisStore).
2. **Guest Expiration Cleanup Cron:**
   - *Current Implementation:* Expired guest sessions are rejected upon lookup (`expiresAt <= now`).
   - *Recommendation:* A periodic database maintenance worker or cron job should purge expired `GuestSession` rows older than 7 days to reclaim storage.
3. **Internal Network Segmentation:**
   - *Recommendation:* In containerized deployment (Docker Compose / Kubernetes), FastAPI should run on an isolated container network where only the Express container has network access to port 8000.
