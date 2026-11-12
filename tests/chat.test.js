const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { startTestServer, stopTestServer, apiRequest, resetRateLimiters, prisma } = require("./helpers/setup");
const config = require("../src/config/env");

describe("D. Chat API Gateway & AI Service Integration", () => {
  let mockAiServer = null;
  let mockAiPort = 0;
  let mockAiHandler = null;
  let userToken, user;
  let guestToken, guest;

  before(async () => {
    mockAiServer = http.createServer((req, res) => {
      if (mockAiHandler) {
        mockAiHandler(req, res);
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "No mock handler defined" }));
      }
    });

    await new Promise((resolve) => {
      mockAiServer.listen(0, "127.0.0.1", () => {
        mockAiPort = mockAiServer.address().port;
        config.aiServiceUrl = `http://127.0.0.1:${mockAiPort}`;
        resolve();
      });
    });

    await startTestServer();

    const uRes = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: `mock-google-token:chat_tester_${Date.now()}@example.com` }),
    });
    userToken = uRes.body.data.session.token;
    user = uRes.body.data.user;

    const gRes = await apiRequest("/api/guest/session", { method: "POST" });
    guestToken = gRes.body.data.token;
    guest = gRes.body.data;
  });

  after(async () => {
    await stopTestServer();
    if (mockAiServer) {
      await new Promise((resolve) => mockAiServer.close(resolve));
    }
  });

  beforeEach(() => {
    resetRateLimiters();
    mockAiHandler = null;
  });

  it("should reject empty or whitespace message with 400", async () => {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}` },
      body: JSON.stringify({ message: "   " }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_MESSAGE");
  });

  it("should reject message exceeding 4000 characters with 400", async () => {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}` },
      body: JSON.stringify({ message: "a".repeat(4001) }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "MESSAGE_TOO_LONG");
  });

  it("should reject invalid top_k bounds with 400", async () => {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}` },
      body: JSON.stringify({ message: "Valid inquiry", top_k: 50 }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_TOP_K");
  });

  it("should reject invalid conversationId format with 400", async () => {
    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}` },
      body: JSON.stringify({ message: "Valid inquiry", conversationId: "not-a-uuid" }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_CONVERSATION_ID");
  });

  it("should forward chat to FastAPI, save conversation, messages, citations, and AIRequestLog", async () => {
    const sampleAiResponse = {
      userId: user.id,
      summary: "Under Section 12 of the Legal Services Authorities Act, 1987, marginalized citizens are eligible for free legal aid.",
      steps: [
        "Visit your District Legal Services Authority (DLSA) office.",
        "Provide income certificate or identity proof.",
        "A panel advocate will be assigned free of cost."
      ],
      important: "Free legal aid is provided without administrative fee.",
      portal: {
        title: "National Legal Services Authority (NALSA)",
        url: "https://nalsa.gov.in",
        domain: "nalsa.gov.in"
      },
      source: "Legal Services Authorities Act, 1987 (Ministry of Law & Justice)",
      followUps: [
        "What is the income ceiling for legal aid in my state?",
        "How do I apply for legal aid through the 15100 helpline?"
      ],
      citations: [
        {
          chunk_id: "DOJ_STAT_ACT_LSA_SEC12_ELIGIBILITY",
          document: "Legal Services Authorities Act, 1987",
          page_range: "Section 12",
          source_url: "https://nalsa.gov.in/act",
          fidelity_classification: "verbatim",
          data_as_of: "1987-10-11",
          publication_date: "1987-10-11"
        }
      ],
      audit: {
        information_type: "static",
        publication_date: "1987-10-11",
        derived_analysis: null,
        audit_notes: null
      }
    };

    mockAiHandler = (req, res) => {
      assert.equal(req.method, "POST");
      assert.equal(req.url, "/api/v1/chat");
      assert.equal(req.headers["content-type"], "application/json");

      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        const parsed = JSON.parse(body);
        assert.equal(parsed.message, "Who is eligible for free legal aid under Section 12?");
        assert.equal(parsed.top_k, 3);
        assert.equal(parsed.language, "en");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sampleAiResponse));
      });
    };

    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "Authorization": `Bearer ${userToken}` },
      body: JSON.stringify({
        message: "Who is eligible for free legal aid under Section 12?",
        top_k: 3,
        language: "en",
      }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "success");
    const data = res.body.data;

    assert.ok(data.conversationId);
    assert.ok(data.messageId);
    assert.equal(data.summary, sampleAiResponse.summary);
    assert.equal(data.portal.domain, "nalsa.gov.in");
    assert.equal(data.citations.length, 1);
    assert.equal(data.citations[0].chunk_id, "DOJ_STAT_ACT_LSA_SEC12_ELIGIBILITY");

    const dbConv = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { messages: { include: { citations: true } } },
    });
    assert.ok(dbConv);
    assert.equal(dbConv.userId, user.id);
    assert.equal(dbConv.guestSessionId, null);
    assert.equal(dbConv.messages.length, 2);

    const userMsg = dbConv.messages.find(m => m.role === "user");
    const assistantMsg = dbConv.messages.find(m => m.role === "assistant");
    assert.ok(userMsg);
    assert.ok(assistantMsg);
    assert.equal(userMsg.content, "Who is eligible for free legal aid under Section 12?");
    assert.equal(assistantMsg.content, sampleAiResponse.summary);

    assert.equal(assistantMsg.citations.length, 1);
    const dbCit = assistantMsg.citations[0];
    assert.equal(dbCit.chunkId, "DOJ_STAT_ACT_LSA_SEC12_ELIGIBILITY");
    assert.equal(dbCit.sourceDocument, "Legal Services Authorities Act, 1987");
    assert.equal(dbCit.sourceUrl, "https://nalsa.gov.in/act");
    assert.equal(dbCit.fidelityClassification, "verbatim");
    assert.equal(dbCit.dataAsOf, "1987-10-11");

    const dbLog = await prisma.aIRequestLog.findFirst({
      where: { conversationId: data.conversationId },
    });
    assert.ok(dbLog);
    assert.equal(dbLog.status, "success");
    assert.equal(dbLog.provider, "fastapi/gemini");
    assert.ok(dbLog.latencyMs >= 0);
  });

  it("should handle FastAPI failure and return controlled 503 without fake answer", async () => {
    mockAiHandler = (req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Database connection failed" }));
    };

    const res = await apiRequest("/api/chat", {
      method: "POST",
      headers: { "x-guest-token": guestToken },
      body: JSON.stringify({ message: "What are court filing rules?" }),
    });

    assert.equal(res.status, 503);
    assert.equal(res.body.code, "AI_SERVICE_UNAVAILABLE");
    assert.equal(res.body.data, undefined);
  });

  it("should enforce rate limiting on the chat endpoint", async () => {
    const { MemoryRateLimiter } = require("../src/middleware/rateLimit.middleware");
    const testLimiter = new MemoryRateLimiter({
      windowMs: 60000,
      max: 3,
      message: "Chat rate limit reached",
      code: "CHAT_RATE_LIMIT_EXCEEDED",
    });

    let blocked = false;
    let retryAfter = null;

    const mockReq = { ip: "127.0.0.1", user: null, guestSession: null, headers: {} };
    const mockRes = {
      set(k, v) { if (k === "Retry-After") retryAfter = v; },
      status(s) {
        if (s === 429) blocked = true;
        return { json: () => {} };
      },
    };

    const mw = testLimiter.middleware();
    mw(mockReq, mockRes, () => {});
    mw(mockReq, mockRes, () => {});
    mw(mockReq, mockRes, () => {});
    mw(mockReq, mockRes, () => {});

    assert.equal(blocked, true);
    assert.ok(retryAfter);
  });
});
