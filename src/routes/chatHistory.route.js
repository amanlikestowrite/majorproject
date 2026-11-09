
const express = require("express");
const prisma = require("../../prisma/lib/prisma");

const chatHistoryRouter = express.Router();

// GET all conversations
chatHistoryRouter.get("/", async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: {
                createdAt: "desc"
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });

        return res.status(200).json({
            message: "Chat history fetched successfully",
            total: users.length,
            data: users
        });

    } catch (err) {
        console.error("Fetch history error:", err);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});


// GET messages of a particular conversation
chatHistoryRouter.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        return res.status(200).json({
            message: "Conversation fetched successfully",
            data: user
        });

    } catch (err) {
        console.error("Fetch conversation error:", err);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

module.exports = chatHistoryRouter;
