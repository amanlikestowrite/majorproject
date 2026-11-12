const express = require("express");
const prisma = require("../../prisma/lib/prisma");
const { AIService } = require("../services/ai.service");

const healthRouter = express.Router();

healthRouter.get("/", async (req, res) => {
  let dbStatus = "healthy";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "unhealthy";
  }

  const aiHealth = await AIService.checkHealth().catch(() => ({ status: "unreachable" }));

  const overallStatus = dbStatus === "healthy" ? "operational" : "degraded";

  return res.status(200).json({
    status: overallStatus,
    service: "nyaya-sahayak-express-gateway",
    version: "1.0.0",
    database: dbStatus,
    aiService: aiHealth.status || "unknown",
    timestamp: new Date().toISOString(),
  });
});

module.exports = healthRouter;
