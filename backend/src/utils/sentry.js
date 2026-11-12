const Sentry = require("@sentry/node");

// Redact credentials that can leak into error messages (e.g. pg connection errors).
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie", "x-api-key"];

function scrubString(value) {
  return typeof value === "string" ? value.replace(URL_CREDENTIALS, "$1[redacted]@") : value;
}

/**
 * Remove sensitive data from an event before it leaves the process.
 * (sendDefaultPii is off, this is a second line of defence.)
 */
function scrubEvent(event) {
  if (event.message) event.message = scrubString(event.message);
  for (const ex of event.exception?.values || []) ex.value = scrubString(ex.value);

  for (const key of Object.keys(event.extra || {}))
    event.extra[key] = scrubString(event.extra[key]);
  for (const crumb of event.breadcrumbs || []) crumb.message = scrubString(crumb.message);

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string; // query strings could carry user input
    for (const name of Object.keys(event.request.headers || {})) {
      if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete event.request.headers[name];
    }
  }
  if (event.user) delete event.user.ip_address;
  return event;
}

let enabled = false;

/** Initialise Sentry. A no-op unless SENTRY_DSN is set. Must run before app code is loaded. */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || process.env.NODE_ENV === "test") return false;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.RENDER_GIT_COMMIT || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0, // errors only: keeps the free quota for errors
    beforeSend: scrubEvent,
  });
  enabled = true;
  return true;
}

const isEnabled = () => enabled;

/** Tag everything captured while handling this request with its request ID. */
function tagRequest(requestId) {
  if (enabled) Sentry.getIsolationScope().setTag("requestId", requestId);
}

/** Report an error logged through logger.error() (route handlers catch and log, so they never reach Express). */
function captureLoggedError(entry) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (entry.requestId) scope.setTag("requestId", entry.requestId);
    if (entry.path) scope.setTag("path", entry.path);
    if (entry.method) scope.setTag("method", entry.method);
    scope.setExtras({ logMessage: scrubString(String(entry.message)) });
    const error = new Error(scrubString(String(entry.message)));
    if (entry.stack) error.stack = scrubString(entry.stack);
    Sentry.captureException(error);
  });
}

module.exports = { Sentry, initSentry, isEnabled, tagRequest, captureLoggedError, scrubEvent };
