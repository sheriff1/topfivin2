import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";

export const dashboardDuration = new Trend("dashboard_req_duration", true);
export const dashboardErrors = new Rate("dashboard_req_errors");

/**
 * Dashboard / Rankings flow:
 *   GET /health
 *   GET /api/categories
 *   GET /api/rankings?category=PPG&season=2025
 *   GET /api/rankings?category=RPG&season=2025
 */
export default function dashboardScenario() {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
  const healthOk = check(healthRes, {
    "health: status 200": (r) => r.status === 200,
    "health: has status field": (r) => {
      try {
        return JSON.parse(r.body).status !== undefined;
      } catch {
        return false;
      }
    },
  });
  dashboardDuration.add(healthRes.timings.duration, { endpoint: "health" });
  dashboardErrors.add(!healthOk);

  sleep(0.5);

  // 2. Fetch categories
  const catRes = http.get(`${BASE_URL}/api/categories`, {
    tags: { name: "categories" },
  });
  const catOk = check(catRes, {
    "categories: status 200": (r) => r.status === 200,
    "categories: returns array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.categories) && body.categories.length > 0;
      } catch {
        return false;
      }
    },
  });
  dashboardDuration.add(catRes.timings.duration, { endpoint: "categories" });
  dashboardErrors.add(!catOk);

  sleep(0.5);

  // 3. Rankings — PPG (most common default view)
  const ppgRes = http.get(
    `${BASE_URL}/api/rankings?category=PPG&season=2025`,
    { tags: { name: "rankings_ppg" } }
  );
  const ppgOk = check(ppgRes, {
    "rankings PPG: status 200": (r) => r.status === 200,
    "rankings PPG: has rankings array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.rankings);
      } catch {
        return false;
      }
    },
  });
  dashboardDuration.add(ppgRes.timings.duration, { endpoint: "rankings_ppg" });
  dashboardErrors.add(!ppgOk);

  sleep(0.5);

  // 4. Rankings — RPG (second most common)
  const rpgRes = http.get(
    `${BASE_URL}/api/rankings?category=RPG&season=2025`,
    { tags: { name: "rankings_rpg" } }
  );
  const rpgOk = check(rpgRes, {
    "rankings RPG: status 200": (r) => r.status === 200,
    "rankings RPG: has rankings array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.rankings);
      } catch {
        return false;
      }
    },
  });
  dashboardDuration.add(rpgRes.timings.duration, { endpoint: "rankings_rpg" });
  dashboardErrors.add(!rpgOk);

  sleep(1);
}
