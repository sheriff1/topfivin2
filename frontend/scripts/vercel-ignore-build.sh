#!/bin/sh
# Vercel "Ignored Build Step": exit 0 = skip the build, exit 1 = build.
# Runs with the project Root Directory (frontend/) as cwd. Skips commits that cannot
# change the frontend output (backend, docs, workflows, tests tooling at repo root).
# Fails open: if git history is unavailable, build.
git rev-parse HEAD^ >/dev/null 2>&1 || exit 1

if git diff --quiet HEAD^ HEAD -- . \
  ../package.json ../pnpm-lock.yaml ../pnpm-workspace.yaml; then
  echo "No frontend-affecting changes; skipping build."
  exit 0
fi
echo "Frontend-affecting changes found; building."
exit 1
