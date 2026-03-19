const winston = require("winston");
const path = require("path");

// Define custom log levels with colors
const customLevels = {
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
  },
  colors: {
    fatal: "red",
    error: "red",
    warn: "yellow",
    info: "green",
    debug: "blue",
    trace: "gray",
  },
};

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "topfivin2-api" },
  transports: [
    // Error log file - only errors and fatal
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "error.log"),
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Combined log file - all levels
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "combined.log"),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: customLevels.colors }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
}

// Add production-specific transports
if (process.env.NODE_ENV === "production") {
  // Could add additional transports here (e.g., Cloud Logging, Datadog, etc.)
}

module.exports = logger;
