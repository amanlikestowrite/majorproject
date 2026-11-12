const express = require("express");
const prisma = require("../../prisma/lib/prisma");
const logger = require("../utils/logger.util");

const chatHistoryRouter = express.Router();

chatHistoryRouter.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        conversations: {
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { citations: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { citations: true },
        },
      },
    });

    return res.status(200).json({
      message: "Chat history fetched successfully",
      total: users.length,
      data: users,
    });
  } catch (err) {
    logger.error("Fetch history error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

chatHistoryRouter.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        conversations: {
          orderBy: { createdAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              include: { citations: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { citations: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      message: "Conversation fetched successfully",
      data: user,
    });
  } catch (err) {
    logger.error("Fetch conversation error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = chatHistoryRouter;
