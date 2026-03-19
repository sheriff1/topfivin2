require("dotenv").config();

const logger = require("./utils/logger");

// Validate environment variables early, before any services initialize
const { validateEnvironment } = require("./config/envValidation");
try {
  validateEnvironment();
  logger.info("✅ Environment variables validated successfully");
} catch (error) {
  logger.error(error.message);
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const db = require("./db/postgresClient");
const cache = require("./cache/redisClient");
const { runMigrations } = require("../migrations/001_init_schema");
const apiRoutes = require("./routes/api");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

// Security headers with Helmet
// Protects against XSS, clickjacking, MIME sniffing, and other attacks
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  // Simple health check without database queries to avoid hangs
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    api: "ok",
  });
});

// API Routes with rate limiting
// Apply general rate limiter to all API endpoints
app.use("/api", apiLimiter, apiRoutes);

/**
 * Error handler for URL decoding errors
 * This handles cases where special characters (like %) appear in URL params
 */
app.use((err, req, res, next) => {
  if (err instanceof URIError && err.message.includes("Failed to decode")) {
    // For decoding errors, try to handle gracefully
    return res.status(400).json({
      success: false,
      message: "Invalid URL parameter encoding",
      error: err.message,
    });
  }
  next(err);
});

/**
 * Initialize application
 */
async function initialize() {
  try {
    logger.info("🚀 Initializing NBA Stats Server...");

    // Step 1: Run database migrations
    logger.info("📊 Setting up database schema...");
    await runMigrations();

    logger.info("✓ Database migrations completed successfully");
  } catch (error) {
    logger.error("❌ Initialization failed:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    await initialize();

    app.listen(PORT, () => {
      logger.info(`✅ Server running on http://localhost:${PORT}`);
      logger.info("📖 API Documentation:");
      logger.info("  GET /health - Health check");
      logger.info("  GET /api/categories - List stat categories");
      logger.info("  GET /api/rankings/:category - Get rankings for a stat");
      logger.info("  GET /api/team/:teamId/stats - Get team stats");
      logger.info("  GET /api/team/:teamId/rankings - Get team rankings");
    });
  } catch (error) {
    logger.error("Failed to start server:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n\n🛑 Shutting down gracefully...");
  try {
    await db.pool.end();
    await cache.redis.quit();
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
});

// Start the application
start();
