process.env.NODE_ENV = "test";
process.env.MOCK_GOOGLE_AUTH = "true";

const http = require("http");
const app = require("../../src/app");
const prisma = require("../../prisma/lib/prisma");
const { _rawAuthLimiter, _rawChatLimiter } = require("../../src/middleware/rateLimit.middleware");

let server = null;
let baseUrl = "";

async function startTestServer() {
  if (server) return { server, baseUrl };

  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve({ server, baseUrl });
    });
  });
}

async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
    baseUrl = "";
  }
}

function resetRateLimiters() {
  if (_rawAuthLimiter) _rawAuthLimiter.reset();
  if (_rawChatLimiter) _rawChatLimiter.reset();
}

async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
  }

  return {
    status: response.status,
    headers: response.headers,
    body: json !== null ? json : text,
  };
}

module.exports = {
  startTestServer,
  stopTestServer,
  resetRateLimiters,
  apiRequest,
  prisma,
};
