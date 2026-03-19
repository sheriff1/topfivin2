/**
 * Environment Variable Validation
 * Ensures required environment variables are present and valid at startup.
 * This prevents hard-to-debug runtime errors later.
 */

class EnvironmentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

/**
 * Validate that environment variables are correctly configured
 * @throws {EnvironmentValidationError} if validation fails
 */
function validateEnvironment() {
  const errors = [];

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || "development";
  const validEnvs = ["development", "test", "production"];
  if (!validEnvs.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of: ${validEnvs.join(", ")}. Got: ${nodeEnv}`);
  }

  // Validate PORT (if provided, must be valid number)
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be a valid number between 1 and 65535. Got: ${process.env.PORT}`);
    }
  }

  // Validate Database Configuration
  // Support both DATABASE_URL format and individual DB_* variables
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasIndividualDbVars = Boolean(
    process.env.DB_HOST &&
    process.env.DB_PORT &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME
  );

  if (!hasDatabaseUrl && !hasIndividualDbVars) {
    errors.push(
      "Database configuration is missing. Provide either:\n" +
        '  1. DATABASE_URL (e.g., "postgresql://user:password@host:port/dbname"), or\n' +
        "  2. All of: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    );
  }

  // Validate individual DB variables if provided
  if (process.env.DB_PORT) {
    const dbPort = parseInt(process.env.DB_PORT, 10);
    if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
      errors.push(
        `DB_PORT must be a valid number between 1 and 65535. Got: ${process.env.DB_PORT}`
      );
    }
  }

  // Validate Redis Configuration
  // Support both REDIS_URL format and individual REDIS_* variables
  const hasRedisUrl = Boolean(process.env.REDIS_URL);
  const hasIndividualRedisVars = Boolean(process.env.REDIS_HOST && process.env.REDIS_PORT);

  if (!hasRedisUrl && !hasIndividualRedisVars) {
    errors.push(
      "Redis configuration is missing. Provide either:\n" +
        '  1. REDIS_URL (e.g., "redis://:password@host:port"), or\n' +
        "  2. Both of: REDIS_HOST, REDIS_PORT (and optionally REDIS_PASSWORD)"
    );
  }

  // Validate individual Redis variables if provided
  if (process.env.REDIS_PORT) {
    const redisPort = parseInt(process.env.REDIS_PORT, 10);
    if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
      errors.push(
        `REDIS_PORT must be a valid number between 1 and 65535. Got: ${process.env.REDIS_PORT}`
      );
    }
  }

  // If there are errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessage = [
      "❌ Environment Variable Validation Failed:",
      "",
      ...errors.map((err, i) => `${i + 1}. ${err}`),
      "",
      "Please check your .env file or environment variables and try again.",
      "Reference: backend/.env.example for required variables.",
    ].join("\n");

    throw new EnvironmentValidationError(errorMessage);
  }

  console.log("✅ Environment variables validated successfully");
}

module.exports = {
  validateEnvironment,
  EnvironmentValidationError,
};
