# API Authentication Design

**Issue:** #54  
**Status:** Design-only — implementation deferred until admin/write endpoints exist  
**Depends on:** #43 (API structure), #53 (CSRF design)  
**Last updated:** March 2026

---

## Table of Contents

1. [Current State — Zero Auth Surface](#1-current-state--zero-auth-surface)
2. [Dual Auth Strategy](#2-dual-auth-strategy)
3. [JWT Auth — Human Admin UI](#3-jwt-auth--human-admin-ui)
4. [API Key Auth — Automated Scripts & CI](#4-api-key-auth--automated-scripts--ci)
5. [Data Model](#5-data-model)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Express Middleware Spec](#7-express-middleware-spec)
8. [Future Admin Endpoints](#8-future-admin-endpoints)
9. [Database Migration Skeleton](#9-database-migration-skeleton)
10. [Package Requirements & Environment Variables](#10-package-requirements--environment-variables)
11. [Relationship to CSRF Design](#11-relationship-to-csrf-design)
12. [Decision Log](#12-decision-log)

---

## 1. Current State — Zero Auth Surface

All API endpoints are public, read-only, and require no authentication. No auth surface exists today:

| Method | Path                        | Public? | Notes                 |
| ------ | --------------------------- | ------- | --------------------- |
| GET    | `/health`                   | Yes     | Health check          |
| GET    | `/api/categories`           | Yes     | Stat category list    |
| GET    | `/api/rankings`             | Yes     | Stat rankings         |
| GET    | `/api/teams`                | Yes     | All teams             |
| GET    | `/api/teams/abbr/:abbr`     | Yes     | Team by abbreviation  |
| GET    | `/api/team/:id/stats`       | Yes     | Team stats            |
| GET    | `/api/team/:id/rankings`    | Yes     | Team rankings         |
| GET    | `/api/audit/games`          | Yes     | Game collection audit |
| GET    | `/api/audit/game/:id/stats` | Yes     | Per-game stats        |

Authentication becomes necessary when admin or write endpoints are added. The design below covers both anticipated caller types.

---

## 2. Dual Auth Strategy

Two distinct caller types are anticipated. They have different needs and warrant different auth mechanisms:

| Caller type        | Who                                     | Auth mechanism                   | Token lifetime                        |
| ------------------ | --------------------------------------- | -------------------------------- | ------------------------------------- |
| Human admin        | Developer/admin using a web dashboard   | JWT (access + refresh token)     | Access: 15–60 min; Refresh: 7–30 days |
| Machine/automation | Python scripts, CI pipelines, cron jobs | API key (pre-issued, long-lived) | Until revoked                         |

Both mechanisms use **custom request headers** (not cookies), which means **no CSRF protection is required** — see [Section 11](#11-relationship-to-csrf-design) and [docs/csrf-design.md](csrf-design.md).

The same `requireAuth` middleware handles both: it checks for an `Authorization: Bearer` header (JWT) or an `X-API-Key` header (API key) and validates accordingly.

---

## 3. JWT Auth — Human Admin UI

### Flow

```
1. Admin submits email + password to POST /api/auth/login
2. Server validates credentials:
     - Looks up admin_users by email
     - Verifies password against bcrypt hash (bcryptjs, rounds ≥ 12)
3. Server issues two tokens:
     - Access token:  JWT, short-lived (15–60 min), signed with JWT_SECRET
     - Refresh token: JWT, long-lived (7–30 days), signed with JWT_REFRESH_SECRET
4. Both tokens returned in response body (not Set-Cookie)
5. Client stores both in localStorage
6. All admin requests include: Authorization: Bearer <access_token>
7. When access token expires (401 response), client calls POST /api/auth/refresh
     - Sends refresh token in request body
     - Receives new access token (+ optionally a new refresh token)
8. On logout, client calls POST /api/auth/logout
     - Server adds refresh token to a short-lived blocklist (Redis key with TTL = token expiry)
     - Client deletes both tokens from localStorage
```

### JWT payload structure

```json
{
  "sub": "42",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1742000000,
  "exp": 1742003600
}
```

Keep payloads minimal — no PII beyond email and role. Never store passwords, full names, or sensitive data in JWT payloads (they are base64-encoded, not encrypted).

### Access token verification middleware (Express sketch)

```js
// backend/src/middleware/authMiddleware.js (future)
const jwt = require("jsonwebtoken");

function verifyJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function extractBearer(req) {
  const header = req.headers["authorization"];
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}
```

---

## 4. API Key Auth — Automated Scripts & CI

API keys are designed for machine-to-machine use: Python data-fetch scripts, CI pipeline triggers, and cron jobs. They are:

- **Pre-issued** by an admin via `POST /api/admin/api-keys`
- **Long-lived** but **revocable** at any time
- **Stored hashed** (bcryptjs) in the `api_keys` table — the raw key is shown **once** at creation and never again
- **Sent via header**: `X-API-Key: <raw_key>`

### Key generation

Generate a cryptographically random key at issuance:

```js
// key format: "sk_" prefix + 32 random bytes as hex = "sk_" + 64 hex chars
const crypto = require("crypto");
const rawKey = "sk_" + crypto.randomBytes(32).toString("hex");
const keyHash = await bcrypt.hash(rawKey, 12);
// Store keyHash in DB; return rawKey to caller exactly once
```

### Key verification (Express sketch)

API key verification is intentionally slower than JWT (due to bcrypt) — this is acceptable because machine callers tolerate latency and bcrypt comparison defeats brute-force enumeration.

```js
// In requireAuth middleware:
const apiKey = req.headers["x-api-key"];
if (apiKey) {
  const keys = await db.query("SELECT * FROM api_keys WHERE revoked_at IS NULL");
  for (const row of keys.rows) {
    if (await bcrypt.compare(apiKey, row.key_hash)) {
      req.user = { sub: row.id, role: row.role, type: "api_key" };
      await db.query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [row.id]);
      return next();
    }
  }
  return res.status(401).json({ success: false, message: "Invalid API key" });
}
```

> **Performance note:** For high-traffic APIs, consider a prefix-based lookup (store first 8 chars of raw key in plaintext alongside the hash) to narrow the bcrypt comparison to one row instead of scanning all keys. Implement this optimisation if key count exceeds ~50.

### Key lifecycle

| Action | How                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------- |
| Create | `POST /api/admin/api-keys` (requires `admin` JWT) — returns `{ id, rawKey }` once                    |
| List   | `GET /api/admin/api-keys` — returns id, name, role, last_used_at, created_at (never hash or raw key) |
| Revoke | `DELETE /api/admin/api-keys/:id` — sets `revoked_at`, key immediately invalid                        |
| Rotate | Revoke old key + create new key                                                                      |

---

## 5. Data Model

### `admin_users` table

Stores credentials for human admin UI logins.

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- bcrypt, rounds ≥ 12
  role          VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_admin_users_email ON admin_users (email);
```

### `api_keys` table

Stores hashed API keys for machine-to-machine callers.

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id           SERIAL PRIMARY KEY,
  key_hash     VARCHAR(255) NOT NULL,     -- bcrypt hash of raw key
  name         VARCHAR(255) NOT NULL,     -- human label, e.g. "CI pipeline"
  role         VARCHAR(50) NOT NULL DEFAULT 'service',
  created_by   INT REFERENCES admin_users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP,
  revoked_at   TIMESTAMP,                -- NULL = active; non-NULL = revoked
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_revoked ON api_keys (revoked_at) WHERE revoked_at IS NULL;
```

**Security notes:**

- `password_hash` and `key_hash` must never appear in API responses
- `email` should always be lowercased before storage and lookup to prevent duplicate accounts
- No `refresh_tokens` table is needed if using a Redis blocklist for logout (TTL = token expiry); add one if Redis-less operation is required

---

## 6. Role-Based Access Control (RBAC)

### Roles

| Role      | Description                                                                                                         | Typical caller                |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `admin`   | Full read/write access to all admin endpoints, including user and key management                                    | Human admin via web dashboard |
| `service` | Write access to data operations (re-fetch, cache invalidation, data corrections) but **not** user or key management | Automated scripts, CI, cron   |

### Route-level enforcement

Routes are protected by two middleware layers:

1. **`requireAuth`** — Validates token (JWT or API key) and populates `req.user`
2. **`requireRole(role)`** — Checks `req.user.role` against the required role

```js
// backend/src/middleware/authMiddleware.js (future)

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}
```

### Endpoint protection matrix

| Endpoint                         | requireAuth | requireRole        |
| -------------------------------- | ----------- | ------------------ |
| `POST /api/auth/login`           | No          | —                  |
| `POST /api/auth/refresh`         | No          | —                  |
| `POST /api/auth/logout`          | Yes         | any                |
| `POST /api/admin/data/refresh`   | Yes         | `admin`, `service` |
| `DELETE /api/admin/cache`        | Yes         | `admin`, `service` |
| `PATCH /api/admin/data/:id`      | Yes         | `admin`, `service` |
| `POST /api/admin/api-keys`       | Yes         | `admin` only       |
| `GET /api/admin/api-keys`        | Yes         | `admin` only       |
| `DELETE /api/admin/api-keys/:id` | Yes         | `admin` only       |
| `GET /api/admin/users`           | Yes         | `admin` only       |

All existing public GET endpoints remain unauthenticated.

---

## 7. Express Middleware Spec

### Unified `requireAuth` middleware

The middleware checks headers in order: JWT Bearer first, then API key. This matches the expected traffic ratio (admin UI more common than API key calls in practice).

```js
// backend/src/middleware/authMiddleware.js (future — full sketch)
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

async function requireAuth(req, res, next) {
  // 1. Try JWT Bearer token
  const bearer = req.headers["authorization"];
  if (bearer && bearer.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(bearer.slice(7), process.env.JWT_SECRET);
      req.user.type = "jwt";
      return next();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  // 2. Try API key
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    // [db lookup + bcrypt.compare — see Section 4]
    // If valid: req.user = { sub, role, type: "api_key" }; next();
    // If invalid: return 401
  }

  return res.status(401).json({ success: false, message: "Authentication required" });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

### Placement in `app.js`

The auth middleware is **not** registered globally — it is applied per-router to avoid accidentally protecting public endpoints:

```
app.use(helmet())                                    ← already in place
app.use(cors({ origin: allowedOrigins }))            ← already in place
app.use(express.json())                              ← already in place
app.get("/health", ...)                              ← already in place (no auth)
app.use("/api", apiLimiter, apiRoutes)               ← already in place (public routes — no auth)
app.use("/api/auth", authRouter)                     ← future: login/refresh/logout (no auth gate on router itself)
app.use("/api/admin", requireAuth, adminRouter)      ← future: all admin routes require auth
```

`requireRole` is applied at the individual route level within `adminRouter`, not at the router level, because different admin routes require different roles.

---

## 8. Future Admin Endpoints

These endpoints do not exist yet. They are specified here to guide future implementation.

### Auth endpoints (`/api/auth`)

| Method | Path                | Auth required  | Body / Response                                                                |
| ------ | ------------------- | -------------- | ------------------------------------------------------------------------------ |
| POST   | `/api/auth/login`   | No             | Body: `{ email, password }` → `{ accessToken, refreshToken }`                  |
| POST   | `/api/auth/refresh` | No             | Body: `{ refreshToken }` → `{ accessToken }`                                   |
| POST   | `/api/auth/logout`  | Yes (any role) | Body: `{ refreshToken }` → `204 No Content`; blocklists refresh token in Redis |

### API key management (`/api/admin/api-keys`)

| Method | Path                      | Required role | Notes                                                   |
| ------ | ------------------------- | ------------- | ------------------------------------------------------- |
| POST   | `/api/admin/api-keys`     | `admin`       | Creates key; returns `{ id, rawKey }` once only         |
| GET    | `/api/admin/api-keys`     | `admin`       | Lists active keys (no hashes); supports `?revoked=true` |
| DELETE | `/api/admin/api-keys/:id` | `admin`       | Revokes key by setting `revoked_at`                     |

### Data operations (`/api/admin/data`)

| Method | Path                      | Required role      | Notes                                                          |
| ------ | ------------------------- | ------------------ | -------------------------------------------------------------- |
| POST   | `/api/admin/data/refresh` | `admin`, `service` | Triggers NBA stats re-fetch; replaces manual Python script run |
| DELETE | `/api/admin/cache`        | `admin`, `service` | Flushes Redis cache for rankings/stats                         |
| PATCH  | `/api/admin/data/:gameId` | `admin`, `service` | Corrects a specific game's stats record                        |

### User management (`/api/admin/users`)

| Method | Path                   | Required role | Notes                                             |
| ------ | ---------------------- | ------------- | ------------------------------------------------- |
| GET    | `/api/admin/users`     | `admin`       | List admin users (no password hashes in response) |
| POST   | `/api/admin/users`     | `admin`       | Create admin user                                 |
| DELETE | `/api/admin/users/:id` | `admin`       | Remove admin user (cannot self-delete)            |

---

## 9. Database Migration Skeleton

When implementing, add auth tables as a new migration following the established naming pattern:

```js
// backend/migrations/004_add_auth_tables.js

const db = require("../src/db/postgresClient");

const schema = `
  CREATE TABLE IF NOT EXISTS admin_users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (lower(email));

  CREATE TABLE IF NOT EXISTS api_keys (
    id           SERIAL PRIMARY KEY,
    key_hash     VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    role         VARCHAR(50) NOT NULL DEFAULT 'service',
    created_by   INT REFERENCES admin_users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMP,
    revoked_at   TIMESTAMP,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (revoked_at) WHERE revoked_at IS NULL;
`;

async function runMigration() {
  console.log("Running migration: 004_add_auth_tables");
  await db.query(schema);
  console.log("Migration 004 complete");
}

module.exports = { runMigration };
```

Call `runMigration()` from the migrations runner in `backend/src/index.js` in the same order as the existing migrations.

---

## 10. Package Requirements & Environment Variables

### npm packages to add (future)

```bash
pnpm --filter backend add jsonwebtoken bcryptjs
```

| Package        | Version | Purpose                                                    |
| -------------- | ------- | ---------------------------------------------------------- |
| `jsonwebtoken` | ^9.x    | JWT sign and verify                                        |
| `bcryptjs`     | ^2.x    | Password and API key hashing (pure JS, no native bindings) |

Neither package exists in `backend/package.json` today. Do not add them until implementation begins — adding unused dependencies increases the attack surface for dependency vulnerabilities.

### Environment variables to add to `backend/.env.example`

```bash
# Authentication (required when admin endpoints are enabled)
JWT_SECRET=                  # Min 32 random bytes; generate: openssl rand -hex 32
JWT_REFRESH_SECRET=          # Separate secret from JWT_SECRET
JWT_ACCESS_EXPIRES_IN=15m    # Access token lifetime (e.g. 15m, 30m, 1h)
JWT_REFRESH_EXPIRES_IN=7d    # Refresh token lifetime (e.g. 7d, 30d)
```

**Security requirements:**

- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be different values
- Minimum 256 bits of entropy (32 random bytes = 64 hex chars): `openssl rand -hex 32`
- Never commit real secrets to version control
- Rotate secrets immediately if leaked; all existing tokens are invalidated on rotation

---

## 11. Relationship to CSRF Design

See [docs/csrf-design.md](csrf-design.md) for the full CSRF analysis. Summary relevant to auth:

**JWT via `Authorization: Bearer` → no CSRF risk**

A cross-origin request forged by a malicious page cannot set the `Authorization` header — browser CORS preflight blocks custom headers from cross-origin requests. Since JWTs are stored in `localStorage` (not cookies), there is nothing for the browser to "auto-attach" to a forged request. The auth header can only be set by JavaScript running in the legitimate app's origin.

**API keys via `X-API-Key` → no CSRF risk**

The same reasoning applies: `X-API-Key` is a custom header. It cannot be forged by a cross-origin attacker. Machine callers set this header programmatically and are not operated via a browser at all.

**If auth mechanism ever changes to cookies:** see the fallback design in `docs/csrf-design.md` — `csrf-csrf` double-submit pattern with `SameSite=Lax` would be required.

---

## 12. Decision Log

| Date       | Decision                                                        | Rationale                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| March 2026 | No auth implemented                                             | Zero write surface; all endpoints are public GET-only; implementation deferred                                                                                                  |
| March 2026 | Dual auth strategy: JWT for human UI + API keys for automation  | Different caller types have different needs; one auth mechanism would be either too cumbersome (API keys for interactive sessions) or too weak (static keys for human sessions) |
| March 2026 | JWT stored in `localStorage`, sent via `Authorization: Bearer`  | Eliminates CSRF by design (per #53); industry standard for SPA + REST API; simpler than HttpOnly cookie approach                                                                |
| March 2026 | API keys sent via `X-API-Key` header                            | Conventional header for API key auth; easily identifiable in logs and proxies; consistent with custom-header CSRF-safe approach                                                 |
| March 2026 | API keys hashed with bcryptjs at rest                           | Raw keys must never be recoverable from the database; bcrypt with ≥12 rounds is appropriate for low-frequency writes                                                            |
| March 2026 | Roles: `admin` (full access) + `service` (data ops only)        | Principle of least privilege — automation scripts should not be able to create/delete admin users or other API keys                                                             |
| March 2026 | `bcryptjs` over `bcrypt` (native)                               | Pure JS implementation avoids native build dependency issues in CI and Docker; performance difference negligible for auth-frequency operations                                  |
| March 2026 | Defer `jsonwebtoken` + `bcryptjs` packages until implementation | Unused dependencies increase supply-chain attack surface; packages should only be added when the code that uses them is merged                                                  |
