# Error Monitoring Design

**Issue:** #64, #194  
**Status:** Sentry integrated (API and browser), opt-in via DSN env vars  
**Depends on:** #52 (structured logging), #55 (error sanitization)  
**Last updated:** November 2026

---

## Table of Contents

1. [Current Logging Infrastructure](#1-current-logging-infrastructure)
2. [What Was Added in This Issue](#2-what-was-added-in-this-issue)
3. [Log Format Reference](#3-log-format-reference)
4. [Request Correlation](#4-request-correlation)
5. [Sentry Integration](#5-sentry-integration)
6. [Alternative Monitoring Tools](#6-alternative-monitoring-tools)
7. [Environment Variables](#7-environment-variables)
8. [Decision Log](#8-decision-log)

---

## 1. Current Logging Infrastructure

### Winston configuration (`backend/src/utils/logger.js`)

The logger uses a custom 6-level hierarchy and outputs structured JSON to stdout (production) and, where a writable disk exists, to rotating log files:

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
| Console   | stdout              | all             | —        | —        |

**Default metadata** appended to every log entry: `{ "service": "topfivin2-api" }`

**Console format:** colorized, human-readable text in development; plain structured JSON (one object per line) when `NODE_ENV=production`, so hosts such as Render capture it from stdout.

**File transports:** enabled by default outside production; in production they are opt-in with `LOG_TO_FILES=true` (ephemeral hosts lose them anyway). Set `LOG_TO_FILES=false` to disable them in development. If `logs/` is not writable the file transports are skipped with a warning and startup continues.

**Log file path:** `process.cwd()/logs/` — ignored by `.gitignore`.

**Graceful shutdown:** on `SIGTERM`/`SIGINT` the API stops accepting connections, waits for in-flight requests (up to `SHUTDOWN_TIMEOUT_MS`, default 10000), closes the Postgres pool, and exits 0 (exits 1 on error or timeout). Manual check: start the API, run `kill -TERM <pid>`, and confirm the "Received SIGTERM" and "Shutdown complete" log lines and exit code 0.

**Production hook:** `logger.js` adds a Sentry transport when Sentry is enabled; other transports can be added there too. See [Section 5](#5-sentry-integration).

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
| `cache/memoryCache.js`        | debug | Cache hits                                                     |
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

Sentry events carry `requestId` as a tag, so they link to the correct log lines. See [Section 5](#5-sentry-integration).

---

## 5. Sentry Integration

Implemented in #194. Sentry is **opt-in**: nothing is initialised unless a DSN is set, so local development and tests are unaffected. Free-tier check (Nov 2026): the Developer plan is still free (one user, ~5,000 errors/month, email alerts), which is plenty here, so Sentry stays.

### API (`@sentry/node`)

| Piece                      | Where                                         | What it does                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initSentry()`             | `utils/sentry.js`, called first in `index.js` | Initialises only if `SENTRY_DSN` is set (never when `NODE_ENV=test`). `environment` = `SENTRY_ENVIRONMENT` or `NODE_ENV`; `release` = `RENDER_GIT_COMMIT`; `tracesSampleRate: 0` (errors only); `sendDefaultPii: false` |
| `tagRequest()`             | `middleware/correlationId.js`                 | Tags every event of a request with `requestId`, matching the `X-Request-ID` header and log lines                                                                                                                        |
| `setupExpressErrorHandler` | `app.js`, before the catch-all handler        | Reports errors that reach Express (5xx) with request context                                                                                                                                                            |
| `SentryTransport`          | `utils/logger.js` (the production hook)       | Route handlers catch errors and call `logger.error`, so they never reach Express; this transport reports those. The catch-all handler logs with `sentryReported: true` so the same error is not sent twice              |
| `scrubEvent`               | `beforeSend` in `utils/sentry.js`             | Redacts `scheme://user:pass@` credentials in messages, exceptions, extras and breadcrumbs; drops cookies, request bodies, query strings, auth/cookie headers and client IP                                              |

### Browser (`@sentry/react`)

`frontend/src/index.jsx` initialises it only in production builds when `VITE_SENTRY_DSN` is set (errors only, no tracing, no replay, no default PII) and wraps the app in `Sentry.ErrorBoundary`.

### Setup

1. Create two projects at sentry.io: Node.js (API) and React (browser). Copy each DSN.
2. Render (service `topfivin2-api`): set `SENTRY_DSN`; `SENTRY_ENVIRONMENT=production` comes from `render.yaml`.
3. Vercel (project `topfivein`, Production): set `VITE_SENTRY_DSN` (and optionally `VITE_SENTRY_ENVIRONMENT`), then redeploy, since Vite bakes it in at build time.
4. Verify: trigger an error (for example stop the database or temporarily throw in a route) and check that the event appears with a `requestId` tag. Use that tag to find the matching log lines in Render.

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

API (`backend/.env.example`, Render):

```bash
SENTRY_DSN=                # Sentry project DSN; leave blank to disable Sentry
SENTRY_ENVIRONMENT=        # production | staging | development (default: NODE_ENV)
```

Frontend (`frontend/.env.example`, Vercel):

```bash
VITE_SENTRY_DSN=           # Browser Sentry project DSN; leave blank to disable
VITE_SENTRY_ENVIRONMENT=   # default: production
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
| Nov 2026   | Sentry integrated (#194), free Developer plan kept       | Free tier still covers a prototype; errors only (no tracing/replay) to preserve quota; opt-in via DSN       |
