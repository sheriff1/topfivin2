const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./utils/logger");
const correlationId = require("./middleware/correlationId");
const requestLogger = require("./middleware/requestLogger");

const db = require("./db/postgresClient");
const apiRoutes = require("./routes/api");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

// Trust the host's proxy hops so req.ip (and express-rate-limit) see the real client IP.
// Hop count comes from TRUST_PROXY (default 1, fine locally); Render needs 3, see render.yaml.
const trustProxy = process.env.TRUST_PROXY;
app.set(
  "trust proxy",
  trustProxy === undefined || trustProxy === "" ? 1 : parseTrustProxy(trustProxy)
);

function parseTrustProxy(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
  return value; // e.g. "loopback" or a CIDR list, passed through to Express
}

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

// Deep readiness check (touches the database). Not for the host's health check: on Neon it would
// keep waking an auto-suspended database. Use /health for that.
app.get("/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ready", timestamp: new Date().toISOString(), api: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable", api: "ok", database: "error" });
  }
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
