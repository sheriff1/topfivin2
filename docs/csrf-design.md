# CSRF Protection Design

**Issue:** #53  
**Status:** Design-only — implementation deferred until write endpoints exist  
**Depends on:** #43 (API structure), #54 (auth design)  
**Last updated:** March 2026

---

## Table of Contents

1. [Current State — Zero CSRF Risk](#1-current-state--zero-csrf-risk)
2. [CSRF Attack Model](#2-csrf-attack-model)
3. [Chosen Approach: Authorization Header (Bearer Token)](#3-chosen-approach-authorization-header-bearer-token)
4. [Residual Risks](#4-residual-risks)
5. [Fallback Design: If Cookie Auth Is Ever Used](#5-fallback-design-if-cookie-auth-is-ever-used)
6. [Implementation Spec for Future Write Endpoints](#6-implementation-spec-for-future-write-endpoints)
7. [Decision Log](#7-decision-log)

---

## 1. Current State — Zero CSRF Risk

As of this writing, **all API endpoints are read-only (`GET`) with no authentication requirement**. This means CSRF is not currently a concern:

| Method | Path                        | Authenticated? | CSRF Risk? |
| ------ | --------------------------- | -------------- | ---------- |
| GET    | `/health`                   | No             | None       |
| GET    | `/api/categories`           | No             | None       |
| GET    | `/api/rankings`             | No             | None       |
| GET    | `/api/teams`                | No             | None       |
| GET    | `/api/teams/abbr/:abbr`     | No             | None       |
| GET    | `/api/team/:id/stats`       | No             | None       |
| GET    | `/api/team/:id/rankings`    | No             | None       |
| GET    | `/api/audit/games`          | No             | None       |
| GET    | `/api/audit/game/:id/stats` | No             | None       |

### Why GET-only routes carry no CSRF risk

The browser's [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) prevents cross-origin reads of response bodies. CSRF attacks are **state-changing** — they trick an authenticated browser into making a request that mutates server state (e.g., `POST /admin/trigger-data-refresh`). A malicious page can cause a browser to _send_ a `GET` request cross-origin, but:

- It cannot read the response (SOP blocks it)
- Our `GET` endpoints do not mutate state

This will change the moment any `POST`, `PUT`, `PATCH`, or `DELETE` endpoint is added behind authentication.

---

## 2. CSRF Attack Model

### How CSRF works

1. User logs into `nba-stats.example.com` — their JWT is stored in an `HttpOnly` cookie
2. User visits `evil.example.com` while still logged in
3. The malicious page contains: `<form action="https://nba-stats.example.com/api/admin/refresh" method="POST"><input type="hidden" name="force" value="true"></form>` with auto-submit JavaScript
4. The browser sends the `POST` request **and automatically attaches the HttpOnly cookie** (same-site rules permitting)
5. The server sees a valid session cookie and processes the request as if the user intended it

### What makes SPAs different

Traditional server-rendered apps are most vulnerable to CSRF because form submissions include cookies by default. Modern SPA + REST API architectures can avoid CSRF entirely depending on **how the auth token is stored and sent**:

| Token storage                     | Sent how                                 | CSRF vulnerable?                   |
| --------------------------------- | ---------------------------------------- | ---------------------------------- |
| `HttpOnly` cookie                 | Browser auto-attaches                    | **Yes — CSRF protection required** |
| `localStorage` / `sessionStorage` | `Authorization: Bearer` header (JS only) | **No — CSRF impossible**           |

A cross-origin request forged by a malicious page **cannot set custom request headers** (such as `Authorization`). Only JavaScript running in the legitimate app's origin can set `Authorization: Bearer <token>`. This is the security property we are relying on.

---

## 3. Chosen Approach: Authorization Header (Bearer Token)

**Decision:** JWTs for future admin endpoints (see [#54](https://github.com/sheriff1/topfivin2/issues/54)) will be stored in `localStorage` and transmitted via the `Authorization: Bearer <token>` request header.

### Why this eliminates CSRF

- A forged cross-origin request (e.g., from a `<form>` or `fetch()` on a malicious site) **cannot include the `Authorization` header** — the browser's CORS preflight would block it, and even if it didn't, JavaScript on `evil.example.com` has no access to tokens stored in `localStorage` on `nba-stats.example.com`
- The server only grants access to requests that include a valid `Authorization` header
- No cookie is involved, so there is nothing for the browser to "auto-attach"

### Express validation (future admin middleware)

```js
// backend/src/middleware/authMiddleware.js (future)
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

module.exports = { requireAuth };

// Usage on a future write route:
// router.post("/admin/refresh", requireAuth, adminRefreshHandler);
```

Because `requireAuth` rejects any request that does not carry a valid `Authorization: Bearer` header, CSRF attacks — which cannot forge this header — are automatically rejected at the authentication layer.

---

## 4. Residual Risks

Choosing `Authorization: Bearer` eliminates CSRF but does not eliminate all security concerns. The following must still be addressed:

### 4.1 XSS (Cross-Site Scripting)

`localStorage` **is accessible to JavaScript**. If an attacker injects malicious JavaScript into the app (XSS), they can read the JWT from `localStorage` and exfiltrate it. XSS is the primary threat model when using `localStorage` for token storage.

**Mitigations already in place:**

- `helmet()` in `app.js` sets `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`
- React's JSX automatically escapes all rendered values (no raw `dangerouslySetInnerHTML` in this codebase)

**Additional mitigations to maintain:**

- Never use `dangerouslySetInnerHTML` with user-supplied data
- Audit all third-party npm dependencies (already enforced via `pnpm audit` in CI)
- Keep JWT expiry short (recommended: 15–60 minutes for admin tokens, with refresh token rotation)

### 4.2 CORS (Cross-Origin Resource Sharing)

Even without CSRF risk, a misconfigured CORS policy could allow unintended cross-origin access. Current `app.js` configuration:

```js
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
```

**This is correct.** Do not change this to `cors({ origin: "*" })` — that would allow any origin to read API responses.

When deploying to production, set `FRONTEND_URL` to the exact frontend domain (e.g., `https://nba-stats.example.com`). Never use a wildcard in production.

### 4.3 SameSite on any cookies set

Even though the JWT will use `Authorization: Bearer`, the app may set other cookies (e.g., session identifiers, analytics). Any cookie set by the backend **must** include `SameSite=Lax` at minimum:

```
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

- `SameSite=Strict` — cookie never sent cross-origin (most secure, may break OAuth flows)
- `SameSite=Lax` — cookie sent on top-level navigations, blocked on cross-origin `POST` (safe default)
- `SameSite=None; Secure` — required for third-party embed scenarios only

Currently no cookies are set by this app. If that changes, apply `SameSite=Lax` by default.

---

## 5. Fallback Design: If Cookie Auth Is Ever Used

If a future decision is made to store JWTs in `HttpOnly` cookies instead of `localStorage` (e.g., for improved XSS resilience), CSRF protection **must** be implemented before any write endpoints go live.

### Recommended approach: Double-Submit Cookie + SameSite=Lax

**Do not use `csurf`** — it is deprecated and unmaintained. Use [`csrf-csrf`](https://www.npmjs.com/package/csrf-csrf) instead.

```bash
pnpm --filter backend add csrf-csrf
```

#### Server-side integration

```js
// backend/src/app.js (modified for cookie-auth scenario)
const { doubleCsrf } = require("csrf-csrf");

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: "__Host-psifi.x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
});

// Serve CSRF token to the SPA on initial load
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: generateToken(req, res) });
});

// Apply CSRF protection to all state-changing routes
// (after the CSRF token endpoint, which must be exempt)
app.use("/api/admin", doubleCsrfProtection, adminRouter);
```

#### Client-side integration

```js
// frontend: fetch CSRF token on app init, store in memory (not localStorage)
const { csrfToken } = await fetch("/api/csrf-token").then((r) => r.json());

// Include in every write request
await fetch("/api/admin/refresh", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  },
  body: JSON.stringify({ force: true }),
});
```

### Why double-submit works

The server sets an `HttpOnly` CSRF cookie and separately returns a CSRF token value. The JavaScript reads the token from the response body and sends it back as a header on write requests. A malicious cross-origin page can cause the browser to send the cookie, but it cannot read the token from the SPA's response body (SOP blocks cross-origin reads), so it cannot set the matching `X-CSRF-Token` header.

---

## 6. Implementation Spec for Future Write Endpoints

When the first write endpoint is added, implement the following **before merging to main**:

### Checklist

- [ ] Confirm JWT is stored in `localStorage` and sent via `Authorization: Bearer` (per #54 decision)
- [ ] Verify CORS `allowedOrigins` is set correctly for the production domain
- [ ] Add `requireAuth` middleware to all write routes (see [Section 3](#3-chosen-approach-authorization-header-bearer-token))
- [ ] Confirm no write endpoint is reachable without the `Authorization` header
- [ ] Review Helmet CSP policy — ensure it restricts `script-src` appropriately
- [ ] Add a security test for each write endpoint that confirms a request without `Authorization` returns 401
- [ ] If cookie auth: install `csrf-csrf`, follow [Section 5](#5-fallback-design-if-cookie-auth-is-ever-used)

### Middleware registration order in `app.js`

```
app.use(helmet())             ← security headers (already in place)
app.use(cors(...))            ← CORS allowlist (already in place)
app.use(express.json())       ← parse request body
app.use(apiLimiter)           ← rate limiting (already in place)
                              ← [future] doubleCsrfProtection (only if cookie auth)
app.use("/api/admin", requireAuth, adminRouter)  ← auth guard
```

---

## 7. Decision Log

| Date       | Decision                                                                          | Rationale                                                                             |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| March 2026 | All endpoints are GET-only; no CSRF protection implemented                        | No write surface; implementation is deferred                                          |
| March 2026 | JWT for admin endpoints (#54) will use `Authorization: Bearer` via `localStorage` | Eliminates CSRF by design; simpler architecture; industry standard for SPAs           |
| March 2026 | `csurf` npm package explicitly rejected                                           | Deprecated since 2023; unmaintained; known security issues                            |
| March 2026 | `csrf-csrf` selected as fallback if cookie auth is ever adopted                   | Actively maintained; implements double-submit pattern correctly; Express 5 compatible |
