const express = require("express");
const ChatController = require("../controllers/chat.controller");
const { optionalSession } = require("../middleware/auth.middleware");
const { chatRateLimiter } = require("../middleware/rateLimit.middleware");
const { validateChatRequest } = require("../middleware/validator.middleware");

const router = express.Router();

router.post("/", chatRateLimiter, optionalSession, validateChatRequest, ChatController.handleChat);

module.exports = router;
