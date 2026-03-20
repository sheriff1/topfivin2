# Load Tests — K6 Baseline (Issue #62)

Performance baseline for the NBA Stats Rankings API, targeting 1000+ daily users.

## Prerequisites

### Local Installation

Install k6 via Homebrew (macOS):

```bash
brew install k6
```

Or via the official installer — see [k6 installation docs](https://grafana.com/docs/k6/latest/set-up/install-k6/).

### Running Tests

All tests accept a `BASE_URL` environment variable (defaults to `http://localhost:5001`).
The backend server **must be running** with a live PostgreSQL + Redis connection.

```bash
# Quick sanity check (1 VU × 30s)
make k6-smoke

# Baseline load test (ramp to 20 VUs, ~5 min)
make k6-load

# Stress test (ramp to 50 VUs, find degradation point)
make k6-stress

# Against a deployed URL
BASE_URL=https://your-server.com make k6-load
```

## Test Files

| File        | Purpose                                  | VUs    | Duration |
| ----------- | ---------------------------------------- | ------ | -------- |
| `smoke.js`  | Sanity — all endpoints respond correctly | 1      | 30s      |
| `load.js`   | Baseline — 1000 daily users model        | 0→20→0 | ~5 min   |
| `stress.js` | Degradation — find the breaking point    | 0→50→0 | ~5 min   |

### Scenarios (imported by all runners)

| File                     | Endpoints Covered                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `scenarios/dashboard.js` | `GET /health`, `/api/categories`, `/api/rankings?category=PPG`, `/api/rankings?category=RPG` |
| `scenarios/teams.js`     | `GET /api/teams`, `/api/teams/abbr/BOS`, `/api/team/:id/stats`, `/api/team/:id/rankings`     |
| `scenarios/audit.js`     | `GET /api/audit/games` (all, collected filter, missing filter)                               |

> **Note:** `GET /api/audit/game/:gameId/stats` is excluded — it requires a real `gameId` from the database, which is not known at script time.

## Pass/Fail Thresholds

### Smoke & Load tests (blocking)

| Metric                  | Threshold   | Rationale             |
| ----------------------- | ----------- | --------------------- |
| `http_req_failed`       | `rate < 1%` | <1% error rate        |
| `http_req_duration` p95 | `< 500ms`   | Snappy UI experience  |
| `http_req_duration` p99 | `< 1000ms`  | Worst-case acceptable |

### Stress test (observational)

| Metric                  | Threshold   | Rationale                   |
| ----------------------- | ----------- | --------------------------- |
| `http_req_failed`       | `rate < 5%` | Alert on severe degradation |
| `http_req_duration` p99 | `< 3000ms`  | Alert on extreme latency    |

## CI Integration

Load tests run via a **manual `workflow_dispatch`** only (they require a live server). See [`.github/workflows/load-test.yml`](../.github/workflows/load-test.yml).

To trigger from GitHub Actions UI:

1. Go to **Actions → Load Tests**
2. Click **Run workflow**
3. Enter the `base_url` of a deployed environment
4. Download the `k6-summary` artifact after the run completes

## Load Model

```
1000 users/day × ~11 requests/session ÷ 8 peak hours ≈ 0.38 RPS average
Baseline VU target: 20 concurrent users (conservative burst headroom)
```

Custom metrics are exported per flow for granular per-endpoint analysis:

- `dashboard_req_duration` / `dashboard_req_errors`
- `teams_req_duration` / `teams_req_errors`
- `audit_req_duration` / `audit_req_errors`
