const express = require("express");
const prisma = require("../../prisma/lib/prisma");
const { AIService } = require("../services/ai.service");
const logger = require("../utils/logger.util");

const userInputRouter = express.Router();

userInputRouter.post("/", async (req, res) => {
  try {
    const { userId, content, conversationId } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        message: "Valid content is required",
      });
    }

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }
    } else {
      user = await prisma.user.create({
        data: {},
      });
    }

    let conversation = null;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: content.trim().slice(0, 40),
        },
      });
    }

    const userMessage = await prisma.message.create({
      data: {
        userId: user.id,
        conversationId: conversation.id,
        role: "user",
        content: content.trim(),
      },
    });

    let aiResult = null;
    try {
      aiResult = await AIService.sendChatMessage({
        message: content.trim(),
        userId: user.id,
      });
    } catch (aiErr) {
      logger.warn("AI service call failed in legacy userInput route", { error: aiErr.message });
    }

    let assistantMessage = null;
    if (aiResult) {
      assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: user.id,
          role: "assistant",
          content: aiResult.summary || "Legal guidance retrieved.",
          structuredResponse: aiResult,
          citations: {
            create: (aiResult.citations || []).map((cit) => ({
              chunkId: cit.chunk_id || "UNKNOWN",
              sourceDocument: cit.document || "Legal Authority",
              sourceUrl: cit.source_url || "https://doj.gov.in",
              pageRange: cit.page_range || null,
              fidelityClassification: cit.fidelity_classification || "verbatim",
              publicationDate: cit.publication_date || null,
              dataAsOf: cit.data_as_of || null,
            })),
          },
        },
        include: {
          citations: true,
        },
      });
    }

    return res.status(201).json({
      message: "Message processed successfully",
      userId: user.id,
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
      guidance: aiResult,
    });
  } catch (err) {
    logger.error("User input error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = userInputRouter;
