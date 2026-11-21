const { Pool } = require("pg");
const logger = require("../utils/logger");

// A serverless Postgres host (e.g. Neon) can take several seconds to wake from idle,
// so allow a generous connect timeout and retry connect-phase failures.
const CONNECT_TIMEOUT_MS = 15000;
const CONNECT_RETRIES = 2;
const CONNECT_RETRY_DELAY_MS = 1000;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 5000,
      max: 10,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "nba_stats",
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 5000,
      max: 10,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", { message: err.message, stack: err.stack });
});

/**
 * True for failures that happen while acquiring a connection, before any SQL is sent,
 * so retrying cannot run a statement twice. Mid-query disconnects are not matched.
 */
function isConnectError(err) {
  const msg = (err && err.message) || "";
  return (
    msg.includes("Connection terminated due to connection timeout") ||
    msg.includes("timeout exceeded when trying to connect") ||
    ["ECONNREFUSED", "ETIMEDOUT"].includes(err && err.code)
  );
}

/**
 * Run fn, retrying with a short backoff when it fails to connect.
 */
async function withConnectRetry(fn, delayMs = CONNECT_RETRY_DELAY_MS) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= CONNECT_RETRIES || !isConnectError(error)) throw error;
      logger.warn(`Database connect failed, retrying (${attempt + 1}/${CONNECT_RETRIES})`, {
        message: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}

/**
 * Execute a query against the database
 * @param {string} query - SQL query string
 * @param {array} values - Query parameters
 * @returns {Promise} - Query result
 */
async function query(text, values) {
  const start = Date.now();
  try {
    const result = await withConnectRetry(() => pool.query(text, values));
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`, { duration });
    return result;
  } catch (error) {
    logger.error("Database query error:", { message: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get a client for transaction management
 * @returns {Promise} - Database client
 */
async function getClient() {
  const client = await withConnectRetry(() => pool.connect());
  return client;
}

module.exports = {
  query,
  getClient,
  pool,
  isConnectError,
  withConnectRetry,
};
