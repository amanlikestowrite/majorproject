const crypto = require("crypto");
const prisma = require("../../prisma/lib/prisma");
const { AIService } = require("../services/ai.service");
const SessionService = require("../services/session.service");
const ConversationController = require("./conversation.controller");
const logger = require("../utils/logger.util");

class ChatController {
  static async handleChat(req, res, next) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const { message, conversationId, language, topic, top_k } = req.validatedBody;

    let user = req.user || null;
    let guestSession = req.guestSession || null;
    let newGuestToken = null;

    try {
      if (!user && !guestSession) {
        const guestInit = await SessionService.createGuestSession();
        guestSession = guestInit.guestSession;
        newGuestToken = guestInit.rawToken;

        res.cookie("nyaya_guest_token", newGuestToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000,
          path: "/",
        });
      }

      const activeUserId = user ? user.id : null;
      const activeGuestId = guestSession ? guestSession.id : null;

      let conversation = null;

      if (conversationId) {
        try {
          conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
          });
        } catch (dbErr) {
          const store = ConversationController.getInMemoryStore();
          conversation = store.get(conversationId) || null;
        }

        if (!conversation) {
          return res.status(404).json({
            status: "error",
            code: "CONVERSATION_NOT_FOUND",
            message: "The requested conversation was not found.",
          });
        }

        const isOwner = user
          ? conversation.userId === user.id
          : conversation.guestSessionId === guestSession.id;

        if (!isOwner) {
          return res.status(403).json({
            status: "error",
            code: "CONVERSATION_ACCESS_DENIED",
            message: "You do not have permission to access or reply to this conversation.",
          });
        }
      } else {
        const words = message.split(/\s+/).slice(0, 6).join(" ");
        const title = words.length > 50 ? `${words.slice(0, 47)}...` : words;

        try {
          conversation = await prisma.conversation.create({
            data: {
              userId: activeUserId,
              guestSessionId: activeGuestId,
              title: title || "Legal Inquiry",
              expiresAt: guestSession ? guestSession.expiresAt : null,
            },
          });
        } catch (dbErr) {
          console.warn("Database unavailable during conversation creation, using memory:", dbErr.message);
          conversation = {
            id: "mem-conv-" + Math.random().toString(36).substring(2, 10),
            userId: activeUserId,
            guestSessionId: activeGuestId,
            title: title || "Legal Inquiry",
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: guestSession ? guestSession.expiresAt : null,
            messages: [],
          };
          const store = ConversationController.getInMemoryStore();
          store.set(conversation.id, conversation);
        }
      }

      const aiResponse = await AIService.getGuidance({
        message,
        userId: activeUserId || activeGuestId,
        conversationId: conversation.id,
        language,
        topic,
        top_k,
        requestId,
      });

      const latencyMs = Date.now() - startTime;

      let userMsg = null;
      let assistantMsg = null;

      try {
        const [uMsg, aMsg] = await prisma.$transaction(async (tx) => {
          const u = await tx.message.create({
            data: {
              conversationId: conversation.id,
              userId: activeUserId,
              role: "user",
              content: message,
            },
          });

          const a = await tx.message.create({
            data: {
              conversationId: conversation.id,
              userId: activeUserId,
              role: "assistant",
              content: aiResponse.summary || "Legal assistance guidance",
              structuredResponse: aiResponse,
            },
          });

          if (Array.isArray(aiResponse.citations) && aiResponse.citations.length > 0) {
            for (const cit of aiResponse.citations) {
              await tx.messageCitation.create({
                data: {
                  messageId: a.id,
                  chunkId: cit.chunk_id || "OFFICIAL_CHUNK",
                  sourceDocument: cit.document || cit.source_document || "Official DoJ Document",
                  sourceUrl: cit.source_url || "https://doj.gov.in",
                  pageRange: cit.page_range || cit.page_number_or_range || null,
                  fidelityClassification: cit.fidelity_classification || "verbatim",
                  publicationDate: cit.publication_date || null,
                  dataAsOf: cit.data_as_of || null,
                },
              });
            }
          }

          await tx.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });

          await tx.aIRequestLog.create({
            data: {
              userId: activeUserId,
              guestSessionId: activeGuestId,
              conversationId: conversation.id,
              provider: "fastapi/gemini",
              model: "gemini-2.5-flash",
              status: "success",
              latencyMs,
              tokenCount: null,
            },
          });

          return [u, a];
        });
        userMsg = uMsg;
        assistantMsg = aMsg;
      } catch (txErr) {
        console.warn("Database unavailable for persisting messages, keeping in memory:", txErr.message);
        userMsg = {
          id: "mem-msg-" + Math.random().toString(36).substring(2, 10),
          conversationId: conversation.id,
          role: "user",
          content: message,
          createdAt: new Date(),
        };
        assistantMsg = {
          id: "mem-msg-" + Math.random().toString(36).substring(2, 10),
          conversationId: conversation.id,
          role: "assistant",
          content: aiResponse.summary || "Legal assistance guidance",
          structuredResponse: aiResponse,
          citations: aiResponse.citations || [],
          createdAt: new Date(),
        };
        if (!conversation.messages) conversation.messages = [];
        conversation.messages.push(userMsg, assistantMsg);
        conversation.updatedAt = new Date();
      }

      return res.status(200).json({
        status: "success",
        data: {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          summary: aiResponse.summary,
          steps: aiResponse.steps || [],
          important: aiResponse.important || null,
          portal: aiResponse.portal || null,
          source: aiResponse.source || null,
          followUps: aiResponse.followUps || [],
          citations: aiResponse.citations || [],
          audit: aiResponse.audit || null,
          createdAt: assistantMsg.createdAt,
        },
        ...(newGuestToken ? { guestToken: newGuestToken } : {}),
      });

    } catch (err) {
      const latencyMs = Date.now() - startTime;

      try {
        await prisma.aIRequestLog.create({
          data: {
            userId: user ? user.id : null,
            guestSessionId: guestSession ? guestSession.id : null,
            conversationId: req.validatedBody.conversationId || null,
            provider: "fastapi/gemini",
            model: "gemini-2.5-flash",
            status: err.code || "FAILED",
            latencyMs,
            tokenCount: null,
          },
        });
      } catch {
      }

      next(err);
    }
  }
}

module.exports = ChatController;
