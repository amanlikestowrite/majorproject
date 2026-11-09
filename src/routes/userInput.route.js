
const express = require("express");
const prisma = require("../../prisma/lib/prisma");

const userInputRouter = express.Router();

userInputRouter.post("/", async (req, res) => {
    try {
        const { userId, content } = req.body;

        // Validate input
        if (!content || typeof content !== "string" || !content.trim()) {
            return res.status(400).json({
                message: "Valid content is required"
            });
        }

        let user;

        // Check whether conversation already exists
        if (userId) {
            user = await prisma.user.findUnique({
                where: {
                    id: userId
                }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found"
                });
            }
        } else {
            // Create a new conversation
            user = await prisma.user.create({
                data: {}
            });
        }

        // Store user message
        const message = await prisma.message.create({
            data: {
                userId: user.id,
                role: "user",
                content: content.trim()
            }
        });

        return res.status(201).json({
            message: "Message stored successfully",
            userId: user.id,
            data: message
        });

    } catch (err) {
        console.error("User input error:", err);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

module.exports = userInputRouter;
