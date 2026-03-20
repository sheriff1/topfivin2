/**
 * Load Test — 1000+ daily users baseline
 *
 * Load model:
 *   1000 users/day × ~11 requests/session ÷ 8 peak hours ≈ 0.38 RPS average
 *   Burst target: 20 concurrent VUs (conservative peak headroom)
 *
 * Stages:
 *   0 → 20 VUs over 1 min  (ramp up)
 *   20 VUs held for 3 min  (steady state)
 *   20 → 0 VUs over 1 min  (ramp down)
 *   Total: ~5 minutes
 *
 * Usage:
 *   k6 run load-tests/load.js
 *   BASE_URL=https://your-server.com k6 run load-tests/load.js
 *   make k6-load
 */

import dashboardScenario from "./scenarios/dashboard.js";
import teamsScenario from "./scenarios/teams.js";
import auditScenario from "./scenarios/audit.js";

export const options = {
  stages: [
    { duration: "1m", target: 20 }, // ramp up to 20 VUs
    { duration: "3m", target: 20 }, // hold at 20 VUs (steady state)
    { duration: "1m", target: 0 }, // ramp down
  ],
  thresholds: {
    // Baseline pass/fail criteria for 1000+ daily users
    http_req_failed: ["rate<0.01"], // <1% error rate
    http_req_duration: ["p(95)<500", "p(99)<1000"], // p95 < 500ms, p99 < 1s
    // Per-flow thresholds
    dashboard_req_errors: ["rate<0.01"],
    teams_req_errors: ["rate<0.01"],
    audit_req_errors: ["rate<0.01"],
    dashboard_req_duration: ["p(95)<500"],
    teams_req_duration: ["p(95)<500"],
    audit_req_duration: ["p(95)<500"],
  },
};

export default function () {
  dashboardScenario();
  teamsScenario();
  auditScenario();
}
