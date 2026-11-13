const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, stopTestServer, apiRequest, prisma } = require("./helpers/setup");
const { hashToken } = require("../src/utils/crypto.util");

describe("B. Google Authentication & User Sessions", () => {
  before(async () => {
    await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it("should reject Google authentication without token", async () => {
    const res = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "MISSING_GOOGLE_TOKEN");
  });

  it("should authenticate with verified Google token and establish session", async () => {
    const mockEmail = `advocate_${Date.now()}@example.com`;
    const res = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({
        idToken: `mock-google-token:${mockEmail}`,
      }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.data.user.email, mockEmail);
    assert.ok(res.body.data.session.id);
    assert.ok(res.body.data.session.token);

    const dbUser = await prisma.user.findUnique({
      where: { email: mockEmail },
    });
    assert.ok(dbUser);
    assert.equal(dbUser.googleSub, `mock-sub-${mockEmail}`);

    const tokenHash = hashToken(res.body.data.session.token);
    const dbSession = await prisma.authSession.findUnique({
      where: { id: res.body.data.session.id },
    });
    assert.ok(dbSession);
    assert.equal(dbSession.sessionTokenHash, tokenHash);
    assert.equal(dbSession.revokedAt, null);

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.ok(setCookie.includes("nyaya_auth_token"));
  });

  it("should fetch current authenticated user profile via /api/auth/me", async () => {
    const mockEmail = `user_me_${Date.now()}@example.com`;
    const loginRes = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:${mockEmail}` }),
    });
    const token = loginRes.body.data.session.token;

    const meRes = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.status, "success");
    assert.equal(meRes.body.data.email, mockEmail);
  });

  it("should reject /api/auth/me without authentication token", async () => {
    const res = await apiRequest("/api/auth/me", { method: "GET" });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "AUTH_REQUIRED");
  });

  it("should logout, revoke session in DB, and prevent subsequent access", async () => {
    const mockEmail = `logout_${Date.now()}@example.com`;
    const loginRes = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:${mockEmail}` }),
    });
    const token = loginRes.body.data.session.token;
    const sessionId = loginRes.body.data.session.id;

    const logoutRes = await apiRequest("/api/auth/logout", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.status, "success");

    const dbSession = await prisma.authSession.findUnique({
      where: { id: sessionId },
    });
    assert.ok(dbSession.revokedAt !== null);

    const meRes = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });
    assert.equal(meRes.status, 401);
    assert.equal(meRes.body.code, "SESSION_INVALID_OR_EXPIRED");
  });

  it("should reject an expired auth session", async () => {
    const mockEmail = `expired_${Date.now()}@example.com`;
    const loginRes = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:${mockEmail}` }),
    });
    const token = loginRes.body.data.session.token;
    const sessionId = loginRes.body.data.session.id;

    await prisma.authSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 10000) },
    });

    const res = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "SESSION_INVALID_OR_EXPIRED");
  });

  it("should register a new user with email and password", async () => {
    const email = `citizen_${Date.now()}@example.com`;
    const res = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: "securePassword123!",
        name: "Citizen Kumar",
      }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.data.user.email, email);
    assert.equal(res.body.data.user.name, "Citizen Kumar");
    assert.ok(res.body.data.session.token);

    const dbUser = await prisma.user.findUnique({ where: { email } });
    assert.ok(dbUser);
    assert.ok(dbUser.passwordHash);
    assert.ok(dbUser.passwordHash.includes(":"));
  });

  it("should reject duplicate registration with existing email", async () => {
    const email = `dupe_${Date.now()}@example.com`;
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "password123", name: "Dupe User" }),
    });

    const res = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "password123", name: "Dupe User" }),
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EMAIL_ALREADY_EXISTS");
  });

  it("should login an existing user with valid email and password", async () => {
    const email = `login_${Date.now()}@example.com`;
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "correctPassword123" }),
    });

    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "correctPassword123" }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.data.user.email, email);
    assert.ok(res.body.data.session.token);
  });

  it("should reject login with wrong password", async () => {
    const email = `wrong_${Date.now()}@example.com`;
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "realPassword123" }),
    });

    const res = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "incorrectPassword" }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "INVALID_CREDENTIALS");
  });
});
