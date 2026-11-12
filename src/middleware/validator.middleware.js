const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateChatRequest(req, res, next) {
  const { message, top_k, language, conversationId } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      status: "error",
      code: "INVALID_MESSAGE",
      message: "Valid non-empty message string is required.",
    });
  }

  const trimmed = message.trim();
  if (trimmed.length > 4000) {
    return res.status(400).json({
      status: "error",
      code: "MESSAGE_TOO_LONG",
      message: "Message exceeds maximum length of 4000 characters.",
    });
  }

  if (top_k !== undefined) {
    const k = Number(top_k);
    if (!Number.isInteger(k) || k < 1 || k > 10) {
      return res.status(400).json({
        status: "error",
        code: "INVALID_TOP_K",
        message: "top_k must be an integer between 1 and 10.",
      });
    }
  }

  if (language !== undefined && (typeof language !== "string" || language.length > 10)) {
    return res.status(400).json({
      status: "error",
      code: "INVALID_LANGUAGE",
      message: "language must be a valid ISO code string.",
    });
  }

  if (conversationId !== undefined && conversationId !== null) {
    if (typeof conversationId !== "string" || !UUID_REGEX.test(conversationId)) {
      return res.status(400).json({
        status: "error",
        code: "INVALID_CONVERSATION_ID",
        message: "conversationId must be a valid UUID string.",
      });
    }
  }

  req.validatedBody = {
    message: trimmed,
    conversationId: conversationId || undefined,
    top_k: top_k ? Number(top_k) : 3,
    language: language || "en",
    topic: req.body.topic || undefined,
  };

  next();
}

function validateConversationIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
    return res.status(400).json({
      status: "error",
      code: "INVALID_CONVERSATION_ID",
      message: "Conversation ID parameter must be a valid UUID.",
    });
  }
  next();
}

function validateGoogleAuthRequest(req, res, next) {
  const token = req.body.idToken || req.body.credential;
  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({
      status: "error",
      code: "MISSING_GOOGLE_TOKEN",
      message: "Google ID token (idToken or credential) is required.",
    });
  }
  req.idToken = token.trim();
  next();
}

module.exports = {
  validateChatRequest,
  validateConversationIdParam,
  validateGoogleAuthRequest,
};
