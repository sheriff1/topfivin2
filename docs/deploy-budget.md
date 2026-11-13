# Vercel deploy budget

The Vercel Hobby team allows **100 deployments per rolling 24 hours, shared by every project on the
team** (topfivein, family-feud, portfolio, frontend). Hitting it blocks deploys for all of them
("Resource is limited - try again in 24 hours"). topfivein was ~60% of the load in Nov 2026, mostly from
backend/docs-only merges rebuilding an unchanged frontend.

## Before merging a PR

```sh
make vercel-slots
```

Counts the team's deployments over the last 24h (follows pagination). It exits non-zero and says HOLD when
fewer than 5 slots are free. If held, wait; the oldest deployments roll off hourly. A merge costs about
2 slots (one production deploy, plus the preview the PR already used).

## Habits that keep usage low

- One branch and PR per issue. Put follow-up commits on the same branch while it is unmerged, and push
  once when ready rather than after every commit: each push to an open PR is a preview deploy.
- Avoid merge bursts (several PRs merged back to back). Each one is a production deploy.
- Backend, docs and CI-only commits should not build the frontend:
  `frontend/vercel.json` runs `frontend/scripts/vercel-ignore-build.sh`, which skips the build unless
  `frontend/` or the root `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` changed.
  Keep that script's path list in sync if the frontend starts depending on other directories.
- Dashboard settings (not in the repo): skip deployments for unaffected projects in the monorepo
  (Root Directory settings), and disable previews for branches that don't need them (e.g. `dependabot/*`).

## Open question

Whether builds skipped by the ignore step still count toward the 100/day limit was unconfirmed when this
was written. After the first docs-only merge, run `make vercel-slots` before and after to see.
