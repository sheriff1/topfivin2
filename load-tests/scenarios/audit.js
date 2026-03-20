import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";

export const auditDuration = new Trend("audit_req_duration", true);
export const auditErrors = new Rate("audit_req_errors");

/**
 * Audit flow:
 *   GET /api/audit/games?season=2025&limit=50&offset=0
 *   GET /api/audit/games?season=2025&status=collected&limit=50&offset=0
 *   GET /api/audit/games?season=2025&status=missing&limit=50&offset=0
 *
 * NOTE: /api/audit/game/:gameId/stats is intentionally excluded — it requires
 * a real gameId from the database which is not known at script time.
 */
export default function auditScenario() {
  // 1. All games (default view)
  const allRes = http.get(
    `${BASE_URL}/api/audit/games?season=2025&limit=50&offset=0`,
    { tags: { name: "audit_all" } }
  );
  const allOk = check(allRes, {
    "audit all: status 200": (r) => r.status === 200,
    "audit all: has games array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.games);
      } catch {
        return false;
      }
    },
    "audit all: has stats": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.stats && body.stats.total_games !== undefined;
      } catch {
        return false;
      }
    },
  });
  auditDuration.add(allRes.timings.duration, { endpoint: "audit_all" });
  auditErrors.add(!allOk);

  sleep(0.5);

  // 2. Collected games only (status filter)
  const collectedRes = http.get(
    `${BASE_URL}/api/audit/games?season=2025&status=collected&limit=50&offset=0`,
    { tags: { name: "audit_collected" } }
  );
  const collectedOk = check(collectedRes, {
    "audit collected: status 200": (r) => r.status === 200,
    "audit collected: has games array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.games);
      } catch {
        return false;
      }
    },
  });
  auditDuration.add(collectedRes.timings.duration, { endpoint: "audit_collected" });
  auditErrors.add(!collectedOk);

  sleep(0.5);

  // 3. Missing games only (least common, but validates filter path)
  const missingRes = http.get(
    `${BASE_URL}/api/audit/games?season=2025&status=missing&limit=50&offset=0`,
    { tags: { name: "audit_missing" } }
  );
  const missingOk = check(missingRes, {
    "audit missing: status 200": (r) => r.status === 200,
    "audit missing: has games array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.games);
      } catch {
        return false;
      }
    },
  });
  auditDuration.add(missingRes.timings.duration, { endpoint: "audit_missing" });
  auditErrors.add(!missingOk);

  sleep(1);
}
