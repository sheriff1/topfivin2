const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./utils/logger");
const correlationId = require("./middleware/correlationId");
const requestLogger = require("./middleware/requestLogger");

const apiRoutes = require("./routes/api");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_2,
].filter(Boolean);

app.use(correlationId);
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    api: "ok",
  });
});

app.use("/api", apiLimiter, apiRoutes);

app.use((err, req, res, next) => {
  if (err instanceof URIError && err.message.includes("Failed to decode")) {
    return res.status(400).json({
      success: false,
      message: "Invalid URL parameter encoding",
    });
  }
  next(err);
});

// Catch-all error handler — must be last; keeps 4-arg signature for Express error handling

app.use((err, req, res, _next) => {
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    requestId: req.id,
  });
  res.status(500).json({ success: false, message: "An unexpected error occurred" });
});

module.exports = app;
