const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { isEnabled: sentryEnabled, captureLoggedError } = require("./sentry");

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

const isProduction = process.env.NODE_ENV === "production";
const logDir = path.join(process.cwd(), "logs");

// File logging: on by default outside production, opt-in in production via LOG_TO_FILES=true
const fileLoggingEnabled = isProduction
  ? process.env.LOG_TO_FILES === "true"
  : process.env.LOG_TO_FILES !== "false";

// Returns true only if the log directory exists (or can be created) and is writable
function isLogDirWritable() {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.accessSync(logDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const transports = [];
let fileLoggingSkipped = false;

if (fileLoggingEnabled) {
  if (isLogDirWritable()) {
    transports.push(
      // Error log file - only errors and fatal
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
      // Combined log file - all levels
      new winston.transports.File({
        filename: path.join(logDir, "combined.log"),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  } else {
    fileLoggingSkipped = true;
  }
}

if (isProduction) {
  // Structured JSON on stdout so the host's log collector can capture it
  transports.push(new winston.transports.Console());
} else {
  // Human-readable, colorized output in development
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: customLevels.colors }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    })
  );
}

if (sentryEnabled()) {
  // Production hook: forward error/fatal entries to Sentry. Entries flagged `sentryReported`
  // were already captured by Sentry's Express error handler, so skip them to avoid duplicates.
  class SentryTransport extends winston.Transport {
    log(info, callback) {
      if (!info.sentryReported) captureLoggedError(info);
      callback();
    }
  }
  transports.push(new SentryTransport({ level: "error" }));
}

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
  transports,
});

if (fileLoggingSkipped) {
  logger.warn("Log directory is not writable; file logging disabled", { logDir });
}

module.exports = logger;
