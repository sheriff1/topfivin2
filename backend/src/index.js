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

const app = require("./app");
const db = require("./db/postgresClient");
const { runPendingMigrations } = require("../migrations");

const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000;

let server;
let shuttingDown = false;

/**
 * Initialize application
 */
async function initialize() {
  try {
    logger.info("🚀 Initializing NBA Stats Server...");

    // Step 1: Run database migrations
    logger.info("📊 Setting up database schema...");
    const applied = await runPendingMigrations();

    logger.info(
      applied.length
        ? `✓ Applied ${applied.length} database migration(s): ${applied.join(", ")}`
        : "✓ Database schema is up to date"
    );
  } catch (error) {
    logger.error("❌ Initialization failed:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    await initialize();

    server = app.listen(PORT, () => {
      logger.info(`✅ Server running on http://localhost:${PORT}`);
      logger.info("📖 API Documentation:");
      logger.info("  GET /health - Health check");
      logger.info("  GET /api/categories - List stat categories");
      logger.info("  GET /api/rankings?category= - Get rankings for a stat");
      logger.info("  GET /api/team/:teamId/stats - Get team stats");
      logger.info("  GET /api/team/:teamId/rankings - Get team rankings");
    });
  } catch (error) {
    logger.error("Failed to start server:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown: stop accepting connections, drain in-flight requests
 * (bounded by a timeout), close the Postgres pool, then exit.
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`🛑 Received ${signal}, shutting down gracefully...`);

  const forceTimer = setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        // Close idle keep-alive connections so close() can complete
        server.closeIdleConnections?.();
      });
    }
    await db.pool.end();
    logger.info("✓ Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start the application
start();
