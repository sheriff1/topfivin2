const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const apiRoutes = require("./routes/api");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

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
      error: err.message,
    });
  }
  next(err);
});

module.exports = app;
