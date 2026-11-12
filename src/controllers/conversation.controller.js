const prisma = require("../../prisma/lib/prisma");

class ConversationController {
  static async listConversations(req, res, next) {
    try {
      const user = req.user;
      const guest = req.guestSession;

      const whereClause = user
        ? { userId: user.id }
        : { guestSessionId: guest.id };

      const conversations = await prisma.conversation.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      const formatted = conversations.map(c => ({
        id: c.id,
        title: c.title,
        messageCount: c._count.messages,
        lastMessage: c.messages[0] || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        expiresAt: c.expiresAt,
      }));

      return res.status(200).json({
        status: "success",
        total: formatted.length,
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createConversation(req, res, next) {
    try {
      const user = req.user;
      const guest = req.guestSession;
      const title = (req.body && req.body.title && typeof req.body.title === "string")
        ? req.body.title.trim().slice(0, 100)
        : "New Legal Inquiry";

      const conversation = await prisma.conversation.create({
        data: {
          userId: user ? user.id : null,
          guestSessionId: guest ? guest.id : null,
          title,
          expiresAt: guest ? guest.expiresAt : null,
        },
      });

      return res.status(201).json({
        status: "success",
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getConversationById(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const guest = req.guestSession;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              citations: true,
            },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({
          status: "error",
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found.",
        });
      }

      const isOwner = user
        ? conversation.userId === user.id
        : conversation.guestSessionId === guest.id;

      if (!isOwner) {
        return res.status(403).json({
          status: "error",
          code: "CONVERSATION_ACCESS_DENIED",
          message: "You do not have permission to view this conversation.",
        });
      }

      return res.status(200).json({
        status: "success",
        data: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          expiresAt: conversation.expiresAt,
          messages: conversation.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            structuredResponse: m.structuredResponse,
            citations: m.citations,
            createdAt: m.createdAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteConversation(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const guest = req.guestSession;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
      });

      if (!conversation) {
        return res.status(404).json({
          status: "error",
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found.",
        });
      }

      const isOwner = user
        ? conversation.userId === user.id
        : conversation.guestSessionId === guest.id;

      if (!isOwner) {
        return res.status(403).json({
          status: "error",
          code: "CONVERSATION_ACCESS_DENIED",
          message: "You do not have permission to delete this conversation.",
        });
      }

      await prisma.conversation.delete({
        where: { id },
      });

      return res.status(200).json({
        status: "success",
        message: "Conversation deleted successfully.",
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ConversationController;
