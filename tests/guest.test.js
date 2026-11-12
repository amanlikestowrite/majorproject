const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, stopTestServer, apiRequest, prisma } = require("./helpers/setup");
const { hashToken } = require("../src/utils/crypto.util");

describe("A. Guest Session Management", () => {
  before(async () => {
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it("should create a new guest session and return a raw token and sessionId", async () => {
    const res = await apiRequest("/api/guest/session", {
      method: "POST",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "success");
    assert.ok(res.body.data.sessionId);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.token.length, 64);
    assert.ok(res.body.data.expiresAt);

    const tokenHash = hashToken(res.body.data.token);
    const dbSession = await prisma.guestSession.findUnique({
      where: { id: res.body.data.sessionId },
    });

    assert.ok(dbSession);
    assert.equal(dbSession.sessionTokenHash, tokenHash);
    assert.notEqual(dbSession.sessionTokenHash, res.body.data.token);

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.ok(setCookie.includes("nyaya_guest_token"));
  });

  it("should validate an active guest session using x-guest-token header", async () => {
    const createRes = await apiRequest("/api/guest/session", { method: "POST" });
    const { token, sessionId } = createRes.body.data;

    const validateRes = await apiRequest("/api/guest/session", {
      method: "GET",
      headers: { "x-guest-token": token },
    });

    assert.equal(validateRes.status, 200);
    assert.equal(validateRes.body.status, "success");
    assert.equal(validateRes.body.data.sessionId, sessionId);
    assert.equal(validateRes.body.data.active, true);
  });

  it("should validate an active guest session using Authorization Bearer header", async () => {
    const createRes = await apiRequest("/api/guest/session", { method: "POST" });
    const { token, sessionId } = createRes.body.data;

    const validateRes = await apiRequest("/api/guest/session", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });

    assert.equal(validateRes.status, 200);
    assert.equal(validateRes.body.data.sessionId, sessionId);
  });

  it("should validate an active guest session using nyaya_guest_token cookie", async () => {
    const createRes = await apiRequest("/api/guest/session", { method: "POST" });
    const { token, sessionId } = createRes.body.data;

    const validateRes = await apiRequest("/api/guest/session", {
      method: "GET",
      headers: { "Cookie": `nyaya_guest_token=${token}` },
    });

    assert.equal(validateRes.status, 200);
    assert.equal(validateRes.body.data.sessionId, sessionId);
  });

  it("should reject an expired guest session with 401 GUEST_SESSION_EXPIRED", async () => {
    const createRes = await apiRequest("/api/guest/session", { method: "POST" });
    const { token, sessionId } = createRes.body.data;

    await prisma.guestSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });

    const res = await apiRequest("/api/guest/session", {
      method: "GET",
      headers: { "x-guest-token": token },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "GUEST_SESSION_EXPIRED");
  });

  it("should reject an invalid or tampered guest token with 401", async () => {
    const res = await apiRequest("/api/guest/session", {
      method: "GET",
      headers: { "x-guest-token": "completely_invalid_token_1234567890abcdef" },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "GUEST_SESSION_EXPIRED");
  });
});
