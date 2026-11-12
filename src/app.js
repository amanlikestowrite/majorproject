const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const config = require("./config/env");
const logger = require("./utils/logger.util");

const authRouter = require("./routes/auth.route");
const guestRouter = require("./routes/guest.route");
const chatRouter = require("./routes/chat.route");
const conversationRouter = require("./routes/conversation.route");
const healthRouter = require("./routes/health.route");

const userInputRouter = require("./routes/userInput.route");
const chatHistoryRouter = require("./routes/chatHistory.route");

const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");

const app = express();

app.use(cors({
  origin: config.frontendOrigin === "*" ? true : config.frontendOrigin,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const reqId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader("X-Request-Id", reqId);

  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path.startsWith("/userInput")) {
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`, {
        statusCode: res.statusCode,
        ip: req.ip,
        requestId: req.id,
      });
    }
  });

  next();
});

app.use("/api/health", healthRouter);
app.use("/health", healthRouter);

app.use("/api/auth", authRouter);
app.use("/api/guest", guestRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationRouter);

app.use("/userInput", userInputRouter);
app.use("/chatHistory", chatHistoryRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    service: "nyaya-sahayak-express-gateway",
    status: "operational",
    docs: "/api/health",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
