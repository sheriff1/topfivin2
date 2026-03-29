#!/usr/bin/env python3
"""
Interactively generate a single social media image on demand.

Flow:
  1. Show all 30 teams — user picks one.
  2. Query top-5 rankings for that team — user picks a stat.
  3. Generate the image → backend/social_images/manual/<ABBR>_<CATEGORY>_<DATE>.png

Run via:
    make social-image-manual
"""
import os
import sys
from datetime import date
from pathlib import Path

# Reuse everything from the daily generator
from generate_social_images import (
    EXCLUDED_CATEGORIES,
    OUTPUT_BASE,
    STAT_LABELS,
    compose_image,
    get_connection,
    load_env,
)

MANUAL_DIR = OUTPUT_BASE / "manual"


def fetch_teams(conn) -> list[dict]:
    """Return all 30 teams sorted by abbreviation."""
    sql = """
        SELECT team_id, team_name, abbreviation,
               team_colors->>'primary'   AS primary_color,
               team_colors->>'secondary' AS secondary_color
        FROM teams
        ORDER BY abbreviation
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_top5_for_team(conn, team_id: int, season: str) -> list[dict]:
    """Return all top-5 rankings for a team (excluding basic categories)."""
    excluded = tuple(EXCLUDED_CATEGORIES)
    sql = """
        SELECT stat_category, rank, value
        FROM stat_rankings
        WHERE team_id = %s
          AND season = %s
          AND rank <= 5
          AND stat_category NOT IN %s
        ORDER BY rank, stat_category
    """
    with conn.cursor() as cur:
        cur.execute(sql, (team_id, season, excluded))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def pick_option(prompt: str, options: list[str]) -> int:
    """Display numbered options and return the chosen 0-based index."""
    print(f"\n{prompt}")
    for i, opt in enumerate(options, 1):
        print(f"  {i:>3}. {opt}")
    while True:
        raw = input("\nEnter number: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return int(raw) - 1
        print(f"  ⚠️  Please enter a number between 1 and {len(options)}.")


def main() -> None:
    load_env()
    season = os.environ.get("CURRENT_SEASON", "2025")

    conn = get_connection()
    try:
        # Step 1: pick a team
        teams = fetch_teams(conn)
        team_labels = [f"{t['abbreviation']}  {t['team_name']}" for t in teams]
        idx = pick_option("Select a team:", team_labels)
        team = teams[idx]

        # Step 2: show top-5 rankings for that team
        rankings = fetch_top5_for_team(conn, team["team_id"], season)
        if not rankings:
            print(f"\n⚠️  {team['team_name']} has no qualifying top-5 rankings.")
            sys.exit(1)

        stat_labels = []
        for r in rankings:
            label = STAT_LABELS.get(r["stat_category"], r["stat_category"])
            stat_labels.append(f"#{r['rank']} in {label}")
        cat_idx = pick_option(
            f"{team['team_name']} is top 5 in these categories:", stat_labels
        )
        chosen = rankings[cat_idx]

        # Build fact dict matching compose_image's expected shape
        fact = {
            "team_id": team["team_id"],
            "team_name": team["team_name"],
            "abbreviation": team["abbreviation"],
            "primary_color": team["primary_color"],
            "secondary_color": team["secondary_color"],
            "stat_category": chosen["stat_category"],
            "rank": chosen["rank"],
            "value": chosen["value"],
            "label": STAT_LABELS.get(
                chosen["stat_category"], chosen["stat_category"]
            ),
        }

        # Step 3: generate image
        MANUAL_DIR.mkdir(parents=True, exist_ok=True)
        today = date.today().isoformat()
        filename = f"{team['abbreviation']}_{chosen['stat_category']}_{today}.png"
        out_path = MANUAL_DIR / filename

        img = compose_image(fact)
        img.save(out_path, "PNG", optimize=True)
        print(f"\n✅ Image saved to {out_path}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
