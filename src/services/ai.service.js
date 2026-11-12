const config = require("../config/env");
const logger = require("../utils/logger.util");

class AIServiceError extends Error {
  constructor(message, code = "AI_SERVICE_ERROR", status = 502, details = null) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class AIService {
  static async getGuidance({
    message,
    userId,
    conversationId,
    language = "en",
    topic,
    top_k = 3,
    requestId,
  }) {
    const targetUrl = `${config.aiServiceUrl}/api/v1/chat`;
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(config.internalAiSecret ? { "X-Internal-Service-Key": config.internalAiSecret } : {}),
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    };

    const payload = {
      userId: userId || undefined,
      conversationId: conversationId || undefined,
      message,
      language,
      topic: topic || undefined,
      top_k: Number(top_k) || 3,
    };

    const startTime = Date.now();

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error(`FastAPI returned non-200 status (${response.status})`, null, {
          targetUrl,
          statusCode: response.status,
          latencyMs,
          requestId,
        });

        throw new AIServiceError(
          "Legal guidance service returned an error. Please try again shortly.",
          "AI_SERVICE_UNAVAILABLE",
          response.status >= 500 ? 503 : 502,
          errorText
        );
      }

      const data = await response.json();

      logger.info("FastAPI guidance received successfully", {
        latencyMs,
        citationCount: (data.citations || []).length,
        portalDomain: data.portal ? data.portal.domain : null,
        requestId,
      });

      return {
        ...data,
        _latencyMs: latencyMs,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (err.name === "AbortError") {
        logger.error("FastAPI request timed out", err, {
          targetUrl,
          timeoutMs,
          latencyMs,
          requestId,
        });
        throw new AIServiceError(
          "The legal guidance service timed out while assembling verified records. Please retry your inquiry.",
          "AI_SERVICE_TIMEOUT",
          504
        );
      }

      if (err instanceof AIServiceError) {
        throw err;
      }

      logger.error("Failed to connect to FastAPI AI service", err, {
        targetUrl,
        latencyMs,
        requestId,
      });

      throw new AIServiceError(
        "Legal guidance service is currently unreachable. Please try again later.",
        "AI_SERVICE_UNAVAILABLE",
        503
      );
    }
  }

  static async checkHealth() {
    const targetUrl = `${config.aiServiceUrl}/api/v1/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) return { status: "degraded", code: response.status };
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      return { status: "unreachable", error: err.message };
    }
  }
}

module.exports = {
  AIService,
  AIServiceError,
};
