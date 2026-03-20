/**
 * Stress Test — find the degradation threshold
 *
 * Ramps beyond the expected baseline to identify at what concurrency level
 * the server begins to degrade (p95 > 500ms or error rate climbs).
 *
 * Stages:
 *   0 → 20 VUs over 1 min  (warm up at baseline)
 *   20 → 50 VUs over 2 min (stress beyond baseline)
 *   50 VUs held for 1 min  (observe behaviour at peak stress)
 *   50 → 0 VUs over 1 min  (ramp down)
 *   Total: ~5 minutes
 *
 * NOTE: Thresholds here are intentionally relaxed — the goal is observation,
 * not pass/fail. Review the output summary to find where latency climbs.
 *
 * Usage:
 *   k6 run load-tests/stress.js
 *   BASE_URL=https://your-server.com k6 run load-tests/stress.js
 *   make k6-stress
 */

import dashboardScenario from "./scenarios/dashboard.js";
import teamsScenario from "./scenarios/teams.js";
import auditScenario from "./scenarios/audit.js";

export const options = {
  stages: [
    { duration: "1m", target: 20 }, // warm up at baseline
    { duration: "2m", target: 50 }, // ramp to stress target
    { duration: "1m", target: 50 }, // hold at stress peak
    { duration: "1m", target: 0 }, // ramp down
  ],
  thresholds: {
    // Relaxed thresholds — stress test is for observation, not blocking CI
    http_req_failed: ["rate<0.05"], // alert if >5% errors under stress
    http_req_duration: ["p(99)<3000"], // alert if p99 exceeds 3s
    dashboard_req_errors: ["rate<0.05"],
    teams_req_errors: ["rate<0.05"],
    audit_req_errors: ["rate<0.05"],
  },
};

export default function () {
  dashboardScenario();
  teamsScenario();
  auditScenario();
}
