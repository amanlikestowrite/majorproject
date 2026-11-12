const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, stopTestServer, apiRequest, prisma } = require("./helpers/setup");

describe("E. Conversation & Message APIs and Ownership", () => {
  let userTokenA, userA;
  let userTokenB, userB;
  let guestTokenA, guestA;
  let guestTokenB, guestB;

  before(async () => {
    await startTestServer();

    const emailA = `usera_${Date.now()}@example.com`;
    const resA = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:${emailA}` }),
    });
    userTokenA = resA.body.data.session.token;
    userA = resA.body.data.user;

    const emailB = `userb_${Date.now()}@example.com`;
    const resB = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:${emailB}` }),
    });
    userTokenB = resB.body.data.session.token;
    userB = resB.body.data.user;

    const gResA = await apiRequest("/api/guest/session", { method: "POST" });
    guestTokenA = gResA.body.data.token;
    guestA = gResA.body.data;

    const gResB = await apiRequest("/api/guest/session", { method: "POST" });
    guestTokenB = gResB.body.data.token;
    guestB = gResB.body.data;
  });

  after(async () => {
    await stopTestServer();
  });

  it("should allow an authenticated user to create a conversation", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userTokenA}` },
      body: JSON.stringify({ title: "User A Bail Inquiry" }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.data.userId, userA.id);
    assert.equal(res.body.data.guestSessionId, null);
    assert.equal(res.body.data.title, "User A Bail Inquiry");
  });

  it("should allow a guest to create a conversation", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "x-guest-token": guestTokenA },
      body: JSON.stringify({ title: "Guest A Traffic Challan" }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.guestSessionId, guestA.sessionId);
    assert.equal(res.body.data.userId, null);
  });

  it("should list only conversations belonging to User A", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "GET",
      headers: { "Authorization": `Bearer ${userTokenA}` },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    for (const c of res.body.data) {
      assert.notEqual(c.title, "Guest A Traffic Challan");
    }
  });

  it("should list only conversations belonging to Guest A", async () => {
    const res = await apiRequest("/api/conversations", {
      method: "GET",
      headers: { "x-guest-token": guestTokenA },
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    for (const c of res.body.data) {
      assert.notEqual(c.title, "User A Bail Inquiry");
    }
  });

  it("should PREVENT User B from viewing User A's conversation (403 Forbidden)", async () => {
    const cRes = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userTokenA}` },
      body: JSON.stringify({ title: "Confidential Suit of User A" }),
    });
    const convId = cRes.body.data.id;

    const res = await apiRequest(`/api/conversations/${convId}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${userTokenB}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CONVERSATION_ACCESS_DENIED");
  });

  it("should PREVENT Guest B from viewing Guest A's conversation (403 Forbidden)", async () => {
    const cRes = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "x-guest-token": guestTokenA },
      body: JSON.stringify({ title: "Private Guest A Issue" }),
    });
    const convId = cRes.body.data.id;

    const res = await apiRequest(`/api/conversations/${convId}`, {
      method: "GET",
      headers: { "x-guest-token": guestTokenB },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CONVERSATION_ACCESS_DENIED");
  });

  it("should PREVENT Guest A from viewing User A's conversation (403 Forbidden)", async () => {
    const cRes = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userTokenA}` },
      body: JSON.stringify({ title: "User A Specific" }),
    });
    const convId = cRes.body.data.id;

    const res = await apiRequest(`/api/conversations/${convId}`, {
      method: "GET",
      headers: { "x-guest-token": guestTokenA },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "CONVERSATION_ACCESS_DENIED");
  });

  it("should PREVENT non-owner from deleting conversation and allow owner to delete", async () => {
    const cRes = await apiRequest("/api/conversations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userTokenA}` },
      body: JSON.stringify({ title: "To Be Deleted" }),
    });
    const convId = cRes.body.data.id;

    const unauthorizedDel = await apiRequest(`/api/conversations/${convId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${userTokenB}` },
    });
    assert.equal(unauthorizedDel.status, 403);

    const authorizedDel = await apiRequest(`/api/conversations/${convId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${userTokenA}` },
    });
    assert.equal(authorizedDel.status, 200);

    const getRes = await apiRequest(`/api/conversations/${convId}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${userTokenA}` },
    });
    assert.equal(getRes.status, 404);
  });
});
