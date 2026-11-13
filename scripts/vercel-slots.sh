#!/bin/sh
# Count the Vercel team's deployments in the last 24h against the Hobby limit (100/rolling 24h,
# shared by every project on the team). Run before merging. Uses the logged-in `vercel` CLI;
# prints counts only, never tokens or env values. Needs: vercel CLI, python3.
LIMIT=100
HOLD_BELOW=5
cd "$(dirname "$0")/../frontend" || exit 2
since=$(( ($(date +%s) - 86400) * 1000 ))
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
until_arg=""
page=0
while [ "$page" -lt 10 ]; do
  vercel api "/v6/deployments?since=$since&limit=100$until_arg" > "$dir/$page.json" 2>/dev/null \
    || { echo "vercel api failed (logged in? run: vercel whoami)"; exit 2; }
  next=$(python3 -I -c 'import sys,json; print(json.load(open(sys.argv[1])).get("pagination",{}).get("next") or "")' "$dir/$page.json") \
    || { echo "unexpected API response"; exit 2; }
  [ -z "$next" ] && break
  until_arg="&until=$next"
  page=$((page + 1))
done
python3 -I - "$dir" "$LIMIT" "$HOLD_BELOW" <<'PY'
import sys, json, glob, collections
d, limit, hold = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
c = collections.Counter(); states = collections.Counter(); total = 0
for f in glob.glob(d + "/*.json"):
    for x in json.load(open(f)).get("deployments", []):
        total += 1
        states[x.get("state")] += 1
        c[(x.get("name"), x.get("target") or "preview")] += 1
for (name, target), n in sorted(c.items(), key=lambda i: -i[1]):
    print(f"{n:4d}  {name} ({target})")
free = limit - total
skipped = states.get("CANCELED", 0)
print(f"\nTotal last 24h: {total}/{limit}  free: {max(free, 0)}")
print(f"  built/other: {total - skipped}   skipped (CANCELED): {skipped}")
print("  (unproven: whether skipped builds count toward the limit; see docs/deploy-budget.md)")
if free < hold:
    print(f"HOLD: fewer than {hold} free slots. Do not merge yet.")
    sys.exit(1)
print("OK to merge.")
PY
