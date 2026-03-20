# Error Monitoring Design

**Issue:** #64  
**Status:** Foundation complete — Sentry integration deferred until production deployment  
**Depends on:** #52 (structured logging), #55 (error sanitization)  
**Last updated:** March 2026

---

## Table of Contents

1. [Current Logging Infrastructure](#1-current-logging-infrastructure)
2. [What Was Added in This Issue](#2-what-was-added-in-this-issue)
3. [Log Format Reference](#3-log-format-reference)
4. [Request Correlation](#4-request-correlation)
5. [Future Sentry Integration](#5-future-sentry-integration)
6. [Alternative Monitoring Tools](#6-alternative-monitoring-tools)
7. [Environment Variables](#7-environment-variables)
8. [Decision Log](#8-decision-log)

---

## 1. Current Logging Infrastructure

### Winston configuration (`backend/src/utils/logger.js`)

The logger uses a custom 6-level hierarchy and outputs structured JSON to rotating log files:

| Level   | Priority | Used for                                             |
| ------- | -------- | ---------------------------------------------------- |
| `fatal` | 0        | Process-ending failures (unrecoverable)              |
| `error` | 1        | Caught exceptions, request failures, DB/cache errors |
| `warn`  | 2        | Non-fatal issues (e.g. ranking calculation fallback) |
| `info`  | 3        | Startup events, request access log, milestones       |
| `debug` | 4        | Query timing, cache hits, internal state             |
| `trace` | 5        | Reserved for future high-verbosity diagnostics       |

**Transports:**

| Transport | File                | Levels captured | Max size | Rotation |
| --------- | ------------------- | --------------- | -------- | -------- |
| File      | `logs/error.log`    | error + fatal   | 10 MB    | 5 files  |
| File      | `logs/combined.log` | all levels      | 10 MB    | 5 files  |
| Console   | stdout              | all (dev only)  | —        | —        |

**Default metadata** appended to every log entry: `{ "service": "topfivin2-api" }`

**Log file path:** `process.cwd()/logs/` — ignored by `.gitignore`.

**Production hook:** `logger.js` contains a reserved block for adding production transports (Sentry, Datadog, Cloud Logging). See [Section 5](#5-future-sentry-integration).

### What is logged today

| Location                      | Level | Event                                                          |
| ----------------------------- | ----- | -------------------------------------------------------------- |
| `middleware/requestLogger.js` | info  | Every HTTP request (method, path, status, duration, requestId) |
| `routes/rankings.js`          | error | Category fetch failure, rankings fetch failure                 |
| `routes/teams.js`             | error | Teams, team-by-abbr, team-stats, team-rankings failures        |
| `routes/audit.js`             | error | Audit games and game stats failures                            |
| `app.js`                      | error | Unhandled Express errors (catch-all handler)                   |
| `db/postgresClient.js`        | error | Idle pool errors, query errors                                 |
| `db/postgresClient.js`        | debug | Per-query execution time                                       |
| `cache/redisClient.js`        | info  | Redis connected                                                |
| `cache/redisClient.js`        | error | Redis errors                                                   |
| `cache/redisClient.js`        | debug | Reconnect attempts, cache hits                                 |
| `services/statProcessor.js`   | warn  | Ranking calculation failures (non-fatal)                       |
| `services/statProcessor.js`   | info  | Rankings generation summary                                    |
| `index.js`                    | info  | Server startup milestones                                      |
| `index.js`                    | error | Startup and shutdown failures                                  |

---

## 2. What Was Added in This Issue

### `middleware/correlationId.js`

Generates a UUID (`crypto.randomUUID()` — Node.js built-in) for every request and:

- Attaches it to `req.id` so all downstream handlers can include it in log entries
- Sets the `X-Request-ID` response header so clients can correlate browser-side and server-side events

### `middleware/requestLogger.js`

Logs one `info` entry per HTTP request after the response is sent (`res.on('finish')`), including:

- `method`, `path`, `statusCode`, `duration` (ms), `requestId`
- Skips `GET /health` to prevent uptime probe noise

### `requestId` field in all error logs

Every `logger.error()` call in route handlers and the global error handler now includes `requestId: req.id`. This creates a traceable chain: if a client receives a `500` response, the `X-Request-ID` header value can be searched in `logs/error.log` to find the full context.

### Middleware registration order in `app.js`

```
correlationId     ← assign req.id, set X-Request-ID header (must be first)
requestLogger     ← log request on finish (needs req.id from correlationId)
helmet            ← security headers
cors              ← origin allowlist
express.json      ← body parsing
/health           ← unauthenticated status check
/api + apiLimiter ← public API routes
error handlers    ← URIError + catch-all
```

---

## 3. Log Format Reference

All log entries are JSON. Example entries from `logs/combined.log`:

**HTTP access log (info):**

```json
{
  "level": "info",
  "message": "HTTP request",
  "method": "GET",
  "path": "/api/rankings",
  "statusCode": 200,
  "duration": 14,
  "requestId": "a3f72b1c-4d88-4e2a-b9f3-1234567890ab",
  "service": "topfivin2-api",
  "timestamp": "2026-03-20 11:34:09"
}
```

**Route error (error):**

```json
{
  "level": "error",
  "message": "[API] /rankings - Error:",
  "message": "connect ECONNREFUSED 127.0.0.1:5432",
  "stack": "Error: connect ECONNREFUSED ...\n    at ...",
  "requestId": "a3f72b1c-4d88-4e2a-b9f3-1234567890ab",
  "service": "topfivin2-api",
  "timestamp": "2026-03-20 11:34:09"
}
```

**DB query debug:**

```json
{
  "level": "debug",
  "message": "Query executed in 8ms",
  "duration": 8,
  "service": "topfivin2-api",
  "timestamp": "2026-03-20 11:34:09"
}
```

---

## 4. Request Correlation

The `requestId` field creates a traceable chain across all log entries for a single HTTP request:

```
Client request
    │
    ▼
correlationId middleware
    │  req.id = "a3f72b1c-..."
    │  X-Request-ID: "a3f72b1c-..." header set on response
    │
    ▼
requestLogger middleware (deferred until res.finish)
    │  logs: { message: "HTTP request", requestId: "a3f72b1c-..." }
    │
    ▼
Route handler
    │  on error: logger.error("...", { ..., requestId: req.id })
    │            → { requestId: "a3f72b1c-..." } in error.log
    │
    ▼
Client response
    └── X-Request-ID: "a3f72b1c-..." (client can report this to support)
```

**To trace a failing request end-to-end:**

```bash
# Find all log entries for a specific request
grep "a3f72b1c-4d88-4e2a-b9f3-1234567890ab" backend/logs/combined.log | jq .
```

**When Sentry is added:** pass `requestId` as a tag so Sentry events automatically link to the correct log lines. See [Section 5](#5-future-sentry-integration).

---

## 5. Future Sentry Integration

When the app is deployed to a production environment, Sentry should be integrated to provide real-time error alerting with full context. Implementation is intentionally deferred — Sentry requires a DSN which only exists once a Sentry project is created.

### Overview

Sentry captures: unhandled exceptions, `logger.error()` breadcrumbs, performance traces, and request context.

### Step 1 — Install package

```bash
pnpm --filter backend add @sentry/node
```

### Step 2 — Initialize in `index.js`

Sentry must initialize **before** any other `require()` calls to instrument all loaded modules:

```js
// backend/src/index.js — add at the very top, before dotenv
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    integrations: [Sentry.expressIntegration()],
  });
}
```

### Step 3 — Add request handler middleware in `app.js`

```js
// app.js — add after correlationId, before requestLogger
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressRequestHandler());
  // Sets Sentry transaction from req.method + req.path
}
```

### Step 4 — Tag errors with requestId

In the global error handler (`app.js`), pass `requestId` as a Sentry tag:

```js
app.use((err, req, res, _next) => {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("requestId", req.id);
      scope.setTag("path", req.path);
      Sentry.captureException(err);
    });
  }

  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    requestId: req.id,
  });

  res.status(500).json({ success: false, message: "An unexpected error occurred" });
});
```

### Step 5 — Add Winston transport for Sentry (optional)

To forward all `error`-level logs to Sentry (not just unhandled Express errors), add a transport in `logger.js` inside the production hook block:

```js
// logger.js — inside the "add production transports here" block
if (process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  logger.add(
    new winston.transports.Stream({
      level: "error",
      stream: {
        write(message) {
          const entry = JSON.parse(message);
          Sentry.captureMessage(entry.message, {
            level: "error",
            extra: { stack: entry.stack, requestId: entry.requestId },
          });
        },
      },
    })
  );
}
```

### Step 6 — Add `@sentry/node` to `.env.example`

```bash
# Sentry (optional — error monitoring)
SENTRY_DSN=            # From Sentry project settings → Client Keys
SENTRY_ENVIRONMENT=    # production | staging | development
```

### Checklist before enabling Sentry in production

- [ ] Create Sentry project at sentry.io (Node.js platform)
- [ ] Copy DSN to `SENTRY_ENVIRONMENT` in production env
- [ ] Set `SENTRY_ENVIRONMENT=production`
- [ ] Verify `tracesSampleRate` is ≤ 0.1 for production (avoid performance overhead)
- [ ] Confirm PII scrubbing — Sentry's default `sendDefaultPii: false` is correct; do not set it to `true`
- [ ] Test with a deliberate `throw new Error("test")` in a dev environment and confirm the event appears in Sentry

---

## 6. Alternative Monitoring Tools

If Sentry is not chosen, the logging foundation is compatible with these alternatives:

| Tool                       | Integration point                                   | Notes                                                   |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| **Datadog**                | Winston transport (`winston-datadog-logger`)        | Excellent for combined logs + APM + dashboards          |
| **AWS CloudWatch**         | Winston transport (`winston-cloudwatch`)            | Good fit if hosted on AWS (ECS, EC2, Elastic Beanstalk) |
| **Logtail / Better Stack** | Winston transport (`@logtail/winston`)              | Simple setup, searchable log UI, inexpensive            |
| **Grafana Loki**           | Log shipper (`promtail`) reads `logs/combined.log`  | Self-hosted option; pairs with Grafana dashboards       |
| **Google Cloud Logging**   | Winston transport (`@google-cloud/logging-winston`) | Ideal if hosted on GCP                                  |

All tools consume the same JSON log format — no changes to `logger.js` format are needed, only a transport addition.

---

## 7. Environment Variables

New variables to add to `backend/.env.example` when Sentry is enabled:

```bash
# Error Monitoring (optional — add when deploying to production)
SENTRY_DSN=                # Sentry project DSN; leave blank to disable Sentry
SENTRY_ENVIRONMENT=        # production | staging | development (default: NODE_ENV)
```

No new environment variables are required for the logging foundation itself — `crypto.randomUUID()` is a Node.js built-in and requires no configuration.

---

## 8. Decision Log

| Date       | Decision                                                 | Rationale                                                                                                   |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| March 2026 | HTTP access logging added via `requestLogger` middleware | Provides per-request visibility (method, path, status, latency) without external dependencies               |
| March 2026 | Request correlation via `crypto.randomUUID()`            | Node.js built-in since 14.17; no extra package; UUID v4 is sufficiently unique for this scale               |
| March 2026 | `correlationId` registered before `helmet`               | Ensures every request gets an ID regardless of security middleware short-circuiting                         |
| March 2026 | `GET /health` excluded from `requestLogger`              | Avoids log noise from uptime probes (typically polled every 30s)                                            |
| March 2026 | `X-Request-ID` set on every response                     | Allows clients, browser DevTools, and Sentry front-end SDK to correlate with server-side logs               |
| March 2026 | Sentry integration deferred                              | Requires a DSN which only exists at deployment time; foundation is ready, no code changes needed to add it  |
| March 2026 | `@sentry/node` not added to `package.json` yet           | Unused dependencies increase supply-chain risk; add only when DSN is available and Sentry is being wired up |
