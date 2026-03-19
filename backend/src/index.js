require("dotenv").config();

// Validate environment variables early, before any services initialize
const { validateEnvironment } = require("./config/envValidation");
try {
  validateEnvironment();
} catch (error) {
  console.error(error.message);
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
    console.log("🚀 Initializing NBA Stats Server...\n");

    // Step 1: Run database migrations
    console.log("📊 Setting up database schema...");
    await runMigrations();

    console.log("\n");
  } catch (error) {
    console.error("❌ Initialization failed:", error.message);
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    await initialize();

    app.listen(PORT, () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`);
      console.log(`📖 API Documentation:`);
      console.log(`  GET /health - Health check`);
      console.log(`  GET /api/categories - List stat categories`);
      console.log(`  GET /api/rankings/:category - Get rankings for a stat`);
      console.log(`  GET /api/team/:teamId/stats - Get team stats`);
      console.log(`  GET /api/team/:teamId/rankings - Get team rankings`);
      console.log("\n");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
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
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

// Start the application
start();
