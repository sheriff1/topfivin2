# CI/CD Setup - Issue #61

## Overview

This project uses a single unified GitHub Actions workflow (`ci.yml`) to run all quality checks in parallel as a gate before merge to main. All jobs must pass on PRs targeting main.

## Configured Workflow

### **Unified CI** (`ci.yml`)

Five jobs run on every push and PR to main. Four run in parallel; `e2e` waits for `frontend-tests`.

| Job              | Name             | What it does                                                           |
| ---------------- | ---------------- | ---------------------------------------------------------------------- |
| `audit`          | Dependency Audit | `pnpm audit --audit-level=moderate` — blocks moderate+ vulnerabilities |
| `lint`           | Lint & Format    | Prettier format check + ESLint for both backend and frontend           |
| `backend-tests`  | Backend Tests    | Jest test suite for the backend                                        |
| `frontend-tests` | Frontend Tests   | Vitest test suite + Vite production build for the frontend             |
| `e2e`            | E2E Tests        | Playwright end-to-end tests (`needs: frontend-tests`)                  |

- **Node Version**: read from [`.nvmrc`](../../.nvmrc) (`setup-node` `node-version-file`)
- **Package Manager**: pnpm, version read from `packageManager` in the root `package.json` (`pnpm/action-setup` with no `version`)
- **Bumping**: change `.nvmrc` / `packageManager` once; CI and Render both follow
- **Install**: `pnpm install --frozen-lockfile` (each job installs independently)

## Dependency updates

[`.github/dependabot.yml`](../dependabot.yml) opens weekly PRs: minor/patch grouped per ecosystem (npm, GitHub Actions, pip); major bumps arrive as separate PRs and are reviewed by hand. ESLint majors and the `nba_api` git pin are ignored. Minor/patch PRs are squash auto-merged by `dependabot-automerge.yml` once the required checks pass; majors are never auto-merged. `main` is protected: the five CI jobs (Dependency Audit, Lint & Format, Backend Tests, Frontend Tests, E2E Tests) are required, force-push and deletion are blocked, and admins can still bypass.

## Trigger Events

```yaml
on:
  push:
    branches: [main, "**"] # All branches
  pull_request:
    branches: [main] # PRs targeting main only
```

## Protecting Main Branch

To enforce that all checks pass before PR merge:

1. Go to **Settings** → **Branches**
2. Create/Edit the **main** branch protection rule
3. Enable **Require status checks to pass before merging**
4. Add required status checks:
   - `Dependency Audit`
   - `Lint & Format`
   - `Backend Tests`
   - `Frontend Tests`
   - `E2E Tests`
5. Enable **Require branches to be up to date before merging**
6. Enable **Dismiss stale pull request approvals when new commits are pushed**

## Monitoring CI Results

### View Workflow Runs

- Visit: `https://github.com/sheriff1/topfivin2/actions`
- Filter by workflow name (`CI`) or branch

### In Pull Requests

- GitHub automatically shows all five job statuses at the bottom of the PR
- Red X = failure (all checks must pass before merge button enables)
- Green checkmark = all checks passed

### Local Development

Before pushing, run checks locally to catch failures early:

```bash
# Dependency audit
pnpm audit --audit-level=moderate

# Lint & format
pnpm --filter backend format:check && pnpm --filter frontend format:check
pnpm --filter backend lint && pnpm --filter frontend lint

# Tests
pnpm --filter backend test
pnpm --filter frontend test

# Frontend build
pnpm --filter frontend build
```

## Troubleshooting Failed Checks

### Dependency Audit Failing

- Run: `pnpm audit` to see vulnerabilities
- Fix by updating vulnerable package: `pnpm up package-name`
- Audit level set to `moderate` — blocks moderate, high, and critical vulnerabilities

### Lint & Format Failing

- Run: `pnpm --filter backend format:check && pnpm --filter frontend format:check`
- Auto-fix formatting: `pnpm --filter backend format && pnpm --filter frontend format`
- Run: `pnpm --filter backend lint && pnpm --filter frontend lint`
- Auto-fix lint: `pnpm --filter backend lint:fix && pnpm --filter frontend lint:fix`

### Backend Tests Failing

1. Run locally: `pnpm --filter backend test`
2. Check for:
   - Failed assertions
   - Environmental issues (PostgreSQL mocks)
   - Node version mismatch

### Frontend Tests Failing

1. Run locally: `pnpm --filter frontend test`
2. Check for:
   - Failed test suites
   - Component rendering issues
   - Mock setup problems

### Frontend Build Failing

1. Run locally: `pnpm --filter frontend build`
2. Check for TypeScript/import errors in the Vite output

## Future Enhancements

- [ ] Add code coverage reporting
- [ ] Integration test workflow (#43)
- [ ] Staging deployment on merge to main (#63)
