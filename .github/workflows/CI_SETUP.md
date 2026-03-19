# CI/CD Setup - Issue #56

## Overview

This project uses GitHub Actions to automate test execution as a quality gate. Tests must pass on all branches and PRs before merge to main.

## Configured Workflows

### 1. **Backend Tests** (`backend-tests.yml`)
- **Triggers**: Runs on all branch pushes and pull requests to main
- **Node Version**: 20 LTS
- **Package Manager**: pnpm 10.30.3
- **Steps**:
  1. Install dependencies (`pnpm install --frozen-lockfile`)
  2. Audit dependencies for vulnerabilities (`pnpm audit --audit-level=moderate`) 
  3. Run backend tests (`pnpm --filter backend test`)
  
**Status Check**: `Backend Tests`

### 2. **Frontend Tests** (`frontend-tests.yml`)
- **Triggers**: Runs on all branch pushes and pull requests to main
- **Node Version**: 20 LTS
- **Package Manager**: pnpm 10.30.3
- **Steps**:
  1. Install dependencies (`pnpm install --frozen-lockfile`)
  2. Audit dependencies for vulnerabilities (`pnpm audit --audit-level=moderate`)
  3. Run frontend tests (`pnpm --filter frontend test`)

**Status Check**: `Frontend Tests`

## Trigger Events

```yaml
on:
  push:
    branches: [main, "**"]        # All branches
  pull_request:
    branches: [main]              # PRs targeting main only
```

## Protecting Main Branch

To enforce that all tests pass before PR merge:

1. Go to **Settings** → **Branches**
2. Create/Edit the **main** branch protection rule
3. Enable **Require status checks to pass before merging**
4. Add required status checks:
   - `Backend Tests`
   - `Frontend Tests`
5. Enable **Require branches to be up to date before merging**
6. Enable **Dismiss stale pull request approvals when new commits are pushed**

## Monitoring CI Results

### View Workflow Runs
- Visit: `https://github.com/sheriff1/topfivin2/actions`
- Filter by workflow name or branch

### In Pull Requests
- GitHub automatically shows CI status at bottom of PR
- Red X = failure (checks must pass before merge button enables)
- Green checkmark = all checks passed

### Local Development
Before pushing, run tests locally to catch failures early:

**Backend tests:**
```bash
cd backend
npm test
```

**Frontend tests:**
```bash
cd frontend
npm test
```

## Troubleshooting Failed Checks

### Backend Tests Failing
1. Run locally: `cd backend && npm test`
2. Check for:
   - Missing test files
   - Failed assertions
   - Environmental issues (Redis, PostgreSQL)
   - Node version mismatch

### Frontend Tests Failing
1. Run locally: `cd frontend && npm test`
2. Check for:
   - Missing test files
   - Failed test suites
   - Component rendering issues
   - Mock setup problems

### Dependency Audit Failing
- Run: `pnpm audit` to see vulnerabilities
- Fix by updating vulnerable package: `pnpm up package-name`
- Or update all: `pnpm up`
- Audit level set to `moderate` — blocks moderate, high, and critical vulnerabilities

## Future Enhancements

- [ ] Add code coverage reporting
- [ ] Add E2E test workflow (#46)
- [ ] Add linting/formatting checks (#57)
- [ ] Parallel job execution for faster feedback (#61)
- [ ] Build verification for frontend (#59)
- [ ] Integration test workflow (#43)
