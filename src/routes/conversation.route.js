const express = require("express");
const ConversationController = require("../controllers/conversation.controller");
const { requireAnySession } = require("../middleware/auth.middleware");
const { validateConversationIdParam } = require("../middleware/validator.middleware");

const router = express.Router();

router.get("/", requireAnySession, ConversationController.listConversations);
router.post("/", requireAnySession, ConversationController.createConversation);
router.get("/:id", requireAnySession, validateConversationIdParam, ConversationController.getConversationById);
router.delete("/:id", requireAnySession, validateConversationIdParam, ConversationController.deleteConversation);

module.exports = router;
