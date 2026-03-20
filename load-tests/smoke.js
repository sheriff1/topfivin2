/**
 * Smoke Test — 1 VU × 30s
 *
 * Purpose: fast sanity check that all endpoints respond correctly.
 * Run this before load/stress to confirm the server is healthy.
 *
 * Usage:
 *   k6 run load-tests/smoke.js
 *   BASE_URL=https://your-server.com k6 run load-tests/smoke.js
 *   make k6-smoke
 */

import dashboardScenario from "./scenarios/dashboard.js";
import teamsScenario from "./scenarios/teams.js";
import auditScenario from "./scenarios/audit.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    // All requests: <1% errors, p95 under 500ms
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    // Per-flow error rates
    dashboard_req_errors: ["rate<0.01"],
    teams_req_errors: ["rate<0.01"],
    audit_req_errors: ["rate<0.01"],
  },
};

export default function () {
  dashboardScenario();
  teamsScenario();
  auditScenario();
}
