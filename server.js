const app = require("./src/app");
const config = require("./src/config/env");
const logger = require("./src/utils/logger.util");
const prisma = require("./prisma/lib/prisma");

const port = config.port || 3000;

const server = app.listen(port, () => {
  logger.info(`Nyaya Sahayak Gateway running on port ${port} [${config.env}]`);
});

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully closing HTTP server and database connections...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info("Database connection closed. Exiting process.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful database disconnect", err);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = server;
