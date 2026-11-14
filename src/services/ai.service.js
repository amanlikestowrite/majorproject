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
  static async callGeminiDirect({ message, language = "en", topic, requestId }) {
    if (!config.geminiApiKey) {
      throw new AIServiceError(
        "AI service is unreachable and GEMINI_API_KEY is not configured.",
        "AI_SERVICE_UNAVAILABLE",
        503
      );
    }

    const systemInstruction = `You are "Nyaya Sahayak", an authoritative judicial procedural guidance assistant for the Department of Justice, Ministry of Law & Justice, Government of India.
You provide accurate, structured, empathetic, and legally precise procedural guidance to Indian citizens on judicial procedures, eCourts services, police reporting, statutory protections, legal aid, and filing cases (such as POCSO, FIR, e-filing, domestic violence, consumer disputes, bail, RTI, traffic challans, etc.).
You must respond strictly with a valid JSON object matching this schema:
{
  "summary": "Clear, concise, empathetic procedural summary in HTML format (use <strong> for key statutory terms, offenses, and official authorities)",
  "steps": ["Ordered list of sequential procedural steps with HTML <strong> titles, explaining exactly what the citizen must do"],
  "important": "Crucial statutory safeguards, mandatory reporting provisions, emergency helplines (e.g. Childline 1098, Emergency 112, Women Helpline 181, Cyber Crime 1930), victim identity protection laws (e.g. Section 23 POCSO), or legal notices",
  "portal": {
    "title": "Official Portal Name",
    "url": "Official https link (e.g. https://doj.gov.in, https://services.ecourts.gov.in, https://efiling.ecourts.gov.in, https://wcd.nic.in, https://nalsa.gov.in, https://vcourts.gov.in)",
    "domain": "Domain hostname (e.g. doj.gov.in, ecourts.gov.in, wcd.nic.in, nalsa.gov.in)"
  },
  "source": "Official statutory authority or ministry attribution statement (e.g. Department of Justice, Ministry of Law & Justice, Govt. of India)",
  "followUps": ["3 to 4 helpful, relevant contextual follow-up questions the citizen might ask next"],
  "citations": [
    {
      "chunk_id": "STATUTORY_REF",
      "document": "Relevant Act, Code, or Official Gazette Name (e.g. Protection of Children from Sexual Offences Act, 2012)",
      "page_range": "Section reference, e.g. Section 19 & 24",
      "source_url": "Official https link",
      "fidelity_classification": "structured_from_source"
    }
  ]
}
Language requirement: If the user writes in Hindi or requests Hindi, provide the response in Hindi; otherwise provide in clear English.
Do not wrap in markdown triple backticks. Return ONLY the raw JSON object.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
    const controller = new AbortController();
    const timeoutMs = 25000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error("Gemini Direct API returned non-200 status", null, {
          statusCode: response.status,
          errorText,
          latencyMs,
          requestId,
        });
        throw new AIServiceError(
          "AI guidance generation failed. Please try again shortly.",
          "AI_SERVICE_UNAVAILABLE",
          502,
          errorText
        );
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new AIServiceError("Empty response from AI service", "AI_EMPTY_RESPONSE", 502);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (jsonErr) {
        logger.error("Failed to parse Gemini JSON output", jsonErr, { rawText, requestId });
        throw new AIServiceError("AI service returned unparseable response.", "AI_PARSE_ERROR", 502);
      }

      logger.info("Gemini Direct guidance generated successfully", {
        latencyMs,
        citationCount: (parsed.citations || []).length,
        portalDomain: parsed.portal ? parsed.portal.domain : null,
        requestId,
      });

      return {
        ...parsed,
        generation_status: "grounded_generation",
        provider: "gemini",
        model: "gemini-2.5-flash",
        _latencyMs: latencyMs,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof AIServiceError) throw err;
      if (err.name === "AbortError") {
        throw new AIServiceError("AI generation service timed out.", "AI_SERVICE_TIMEOUT", 504);
      }
      logger.error("Gemini Direct call failed", err, { requestId });
      throw new AIServiceError("AI generation service is currently unreachable.", "AI_SERVICE_UNAVAILABLE", 503);
    }
  }

  static async getGuidance({
    message,
    userId,
    conversationId,
    language = "en",
    topic,
    top_k = 3,
    requestId,
  }) {
    const isLoopback = config.aiServiceUrl.includes("127.0.0.1") || config.aiServiceUrl.includes("localhost");
    const isVercelOrServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || config.useGeminiDirect);

    // When running in serverless (like Vercel) where FastAPI is not hosted locally, use Gemini Direct immediately
    if (isVercelOrServerless && config.geminiApiKey) {
      logger.info("Using Gemini Direct synthesis for serverless deployment", { requestId });
      return await this.callGeminiDirect({ message, language, topic, requestId });
    }

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

      if (err instanceof AIServiceError) {
        throw err;
      }

      // If FastAPI is down or connection refused and we have Gemini key, fallback seamlessly
      if (config.geminiApiKey && (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED")) {
        logger.warn("FastAPI service unreachable; falling back to Gemini Direct synthesis", {
          targetUrl,
          error: err.message,
          requestId,
        });
        try {
          return await this.callGeminiDirect({ message, language, topic, requestId });
        } catch (fallbackErr) {
          logger.error("Gemini fallback also failed", fallbackErr, { requestId });
        }
      }

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
    if (config.useGeminiDirect && config.geminiApiKey) {
      return { status: "healthy", provider: "gemini-direct", model: "gemini-2.5-flash" };
    }

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
      if (!response.ok) {
        if (config.geminiApiKey) {
          return { status: "healthy", provider: "gemini-fallback", model: "gemini-2.5-flash" };
        }
        return { status: "degraded", code: response.status };
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (config.geminiApiKey) {
        return { status: "healthy", provider: "gemini-fallback", model: "gemini-2.5-flash" };
      }
      return { status: "unreachable", error: err.message };
    }
  }
}

module.exports = {
  AIService,
  AIServiceError,
};
