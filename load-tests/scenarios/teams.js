import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";

// Boston Celtics — guaranteed to exist in the dataset
const TEAM_ID = "1610612738";
const TEAM_ABBR = "BOS";

export const teamsDuration = new Trend("teams_req_duration", true);
export const teamsErrors = new Rate("teams_req_errors");

/**
 * Teams flow:
 *   GET /api/teams
 *   GET /api/teams/abbr/BOS
 *   GET /api/team/1610612738/stats?season=2025
 *   GET /api/team/1610612738/rankings?season=2025
 */
export default function teamsScenario() {
  // 1. All teams list
  const allTeamsRes = http.get(`${BASE_URL}/api/teams`, {
    tags: { name: "teams_list" },
  });
  const allTeamsOk = check(allTeamsRes, {
    "teams list: status 200": (r) => r.status === 200,
    "teams list: returns array": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) && body.data.length > 0;
      } catch {
        return false;
      }
    },
  });
  teamsDuration.add(allTeamsRes.timings.duration, { endpoint: "teams_list" });
  teamsErrors.add(!allTeamsOk);

  sleep(0.5);

  // 2. Team by abbreviation (simulates clicking a team card)
  const abbrRes = http.get(`${BASE_URL}/api/teams/abbr/${TEAM_ABBR}`, {
    tags: { name: "teams_abbr" },
  });
  const abbrOk = check(abbrRes, {
    "team by abbr: status 200": (r) => r.status === 200,
    "team by abbr: has team_id": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.team_id !== undefined;
      } catch {
        return false;
      }
    },
  });
  teamsDuration.add(abbrRes.timings.duration, { endpoint: "teams_abbr" });
  teamsErrors.add(!abbrOk);

  sleep(0.5);

  // 3. Team stats (parallel-ish in the UI, but sequential here for simplicity)
  const statsRes = http.get(
    `${BASE_URL}/api/team/${TEAM_ID}/stats?season=2025`,
    { tags: { name: "team_stats" } }
  );
  const statsOk = check(statsRes, {
    "team stats: status 200": (r) => r.status === 200,
    "team stats: has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  teamsDuration.add(statsRes.timings.duration, { endpoint: "team_stats" });
  teamsErrors.add(!statsOk);

  sleep(0.5);

  // 4. Team rankings
  const rankingsRes = http.get(
    `${BASE_URL}/api/team/${TEAM_ID}/rankings?season=2025`,
    { tags: { name: "team_rankings" } }
  );
  const rankingsOk = check(rankingsRes, {
    "team rankings: status 200": (r) => r.status === 200,
    "team rankings: has data": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
  });
  teamsDuration.add(rankingsRes.timings.duration, { endpoint: "team_rankings" });
  teamsErrors.add(!rankingsOk);

  sleep(1);
}
