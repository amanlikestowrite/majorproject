const logger = require("../utils/logger.util");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || (err.statusCode && err.statusCode >= 400 ? err.statusCode : 500);
  const code = err.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");

  logger.error(`Unhandled request error at ${req.method} ${req.originalUrl}`, err, {
    status,
    code,
    ip: req.ip,
  });

  const clientMessage = status >= 500
    ? (err.clientMessage || "An internal server error occurred. Please try again later.")
    : (err.message || "Request failed.");

  res.status(status).json({
    status: "error",
    code,
    message: clientMessage,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    status: "error",
    code: "NOT_FOUND",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
