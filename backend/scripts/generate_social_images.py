#!/usr/bin/env python3
"""
Generate daily social media images (1080×1350 PNG) for each NBA team.

For every team with at least one qualifying top-5 ranking, one random stat is
chosen and rendered in a styled card matching the DidYouKnow component.

Output: backend/social_images/YYYY-MM-DD/<ABBR>.png

Run via:
    make social-images        (local)
    make social-images-prod   (production / Railway DB)
"""
import io
import os
import sys
import textwrap
from datetime import date
from pathlib import Path

import psycopg2
import requests
from PIL import Image, ImageDraw, ImageFont

# ── Constants ─────────────────────────────────────────────────────────────────

IMAGE_W, IMAGE_H = 1080, 1350

FONTS_DIR = Path(__file__).parent / "fonts"
FONT_LEAGUE_GOTHIC = FONTS_DIR / "LeagueGothic-Regular.ttf"
FONT_JAKARTA_BOLD = FONTS_DIR / "PlusJakartaSans-Bold.ttf"

OUTPUT_BASE = Path(__file__).parent.parent / "social_images"

# Jazz (1610612762) and Rockets (1610612745) always use secondary color
SECONDARY_OVERRIDE_IDS = {1610612762, 1610612745}

# Categories excluded from social image selection (too basic / not interesting)
EXCLUDED_CATEGORIES = {
    "W", "L", "WIN_PCT",
    "PPG", "FG_PG", "FGA_PG", "FG%", "THREE_PG", "3P%", "FT%",
    "RPG", "APG", "SPG", "BPG", "TPG", "PFPG",
}

# Human-readable labels for each stat category (mirrors statProcessor.js STAT_CATEGORIES)
STAT_LABELS: dict[str, str] = {
    "FG%": "Field Goal %",
    "3P%": "3-Point %",
    "FT%": "Free Throw %",
    "PPG": "Points Per Game",
    "RPG": "Rebounds Per Game",
    "APG": "Assists Per Game",
    "SPG": "Steals Per Game",
    "BPG": "Blocks Per Game",
    "W": "Wins",
    "L": "Losses",
    "WIN_PCT": "Win %",
    "TS%": "True Shooting %",
    "ORB%": "Offensive Rebound %",
    "DRB%": "Defensive Rebound %",
    "TRB%": "Total Rebound %",
    "AST%": "Assist %",
    "USG%": "Usage %",
    "TOV%": "Turnover %",
    "ORTG": "Offensive Rating",
    "DRTG": "Defensive Rating",
    "NET_RTG": "Net Rating",
    "EFG%": "Effective FG %",
    "PACE": "Pace",
    "PTS_PAINT": "Points in Paint",
    "OPP_PAINT": "Opp Points in Paint",
    "FAST_BRK": "Fast Break Points",
    "OPP_FBRK": "Opp Fast Break Pts",
    "DEFLECT": "Deflections",
    "CONTESTED": "Contested Shots",
    "SCR_AST": "Screen Assists",
    "CONTESTED_2PT": "Contested 2PT Shots",
    "CONTESTED_3PT": "Contested 3PT Shots",
    "CHARGES": "Charges Drawn",
    "BOX_OUTS": "Box Outs",
    "OPP_PTS_OFF_TO": "Opp Pts Off Turnovers",
    "OPP_2ND_CHC": "Opp 2nd Chance Pts",
    "BLK_AGT": "Blocks Against",
    "FOULS_DRAWN": "Fouls Drawn",
    "AST_TOV": "Assist-to-Turnover Ratio",
    "PACE40": "Pace Per 40",
    "BOX_OUT_TREB": "Box Out Team Rebounds",
    "BOX_OUT_PREB": "Box Out Player Rebounds",
    "ORPG": "Offensive Rebounds Per Game",
    "DRPG": "Defensive Rebounds Per Game",
    "TPG": "Turnovers Per Game",
    "PFPG": "Personal Fouls Per Game",
    "PM": "Plus/Minus Per Game",
    "FG_PG": "Field Goals Made Per Game",
    "FGA_PG": "Field Goal Attempts Per Game",
    "THREE_PG": "3-Pointers Made Per Game",
    "POSS": "Possessions Per Game",
    "PIE": "Player Impact Estimate",
    "AST_RATIO": "Assist Ratio",
    "TOV_RATIO": "Turnover Ratio",
    "BIG_LEAD": "Biggest Lead (avg)",
    "LEAD_CHG": "Lead Changes Per Game",
    "TIMES_TIED": "Times Tied Per Game",
    "BIG_RUN": "Biggest Scoring Run (avg)",
    "TOV_TEAM": "Team Turnovers Per Game",
    "TOV_TOTAL": "Total Turnovers Per Game",
    "REB_TEAM": "Team Rebounds Per Game",
    "PTS_2ND_CHC": "2nd Chance Points Per Game",
    "PTS_OFF_TO": "Points Off Turnovers Per Game",
    "SCR_AST_PTS": "Screen Assist Points Per Game",
    "LOOSE_BALLS": "Loose Balls Recovered Per Game",
    "LOOSE_BALLS_O": "Off. Loose Balls Recovered Per Game",
    "LOOSE_BALLS_D": "Def. Loose Balls Recovered Per Game",
    "BOX_OUTS_O": "Offensive Box Outs Per Game",
    "BOX_OUTS_D": "Defensive Box Outs Per Game",
    "STARTERS_PPG": "Starter Points Per Game",
    "STARTERS_RPG": "Starter Rebounds Per Game",
    "STARTERS_APG": "Starter Assists Per Game",
    "STARTERS_SPG": "Starter Steals Per Game",
    "STARTERS_BPG": "Starter Blocks Per Game",
    "STARTERS_FG%": "Starter Field Goal %",
    "STARTERS_3P%": "Starter 3-Point %",
    "STARTERS_FT%": "Starter Free Throw %",
    "BENCH_PPG": "Bench Points Per Game",
    "BENCH_RPG": "Bench Rebounds Per Game",
    "BENCH_APG": "Bench Assists Per Game",
    "BENCH_SPG": "Bench Steals Per Game",
    "BENCH_BPG": "Bench Blocks Per Game",
    "ATTEND": "Average Attendance",
    "Q1_PTS": "Q1 Points Per Game",
    "Q2_PTS": "Q2 Points Per Game",
    "Q3_PTS": "Q3 Points Per Game",
    "Q4_PTS": "Q4 Points Per Game",
    "E_ORTG": "Estimated Off. Rating",
    "E_DRTG": "Estimated Def. Rating",
    "E_NET_RTG": "Estimated Net Rating",
    "E_PACE": "Estimated Pace",
    "DISTANCE": "Distance Traveled (mi)",
    "TOUCHES": "Touches Per Game",
    "SECONDARY_AST": "Secondary Assists Per Game",
    "PASSES": "Passes Per Game",
    "CONTESTED_FGM": "Contested FG Made Per Game",
    "CONTESTED_FGA": "Contested FGA Per Game",
    "CONTESTED_FG%": "Contested FG %",
    "UNCONTESTED_FGM": "Uncontested FG Made Per Game",
}


# ── Environment ───────────────────────────────────────────────────────────────

def load_env() -> None:
    """Load .env or .env.production depending on ENV_FILE env var."""
    env_file = os.environ.get("ENV_FILE", ".env")
    env_path = Path(__file__).parent.parent / env_file
    if not env_path.exists():
        return
    try:
        with open(env_path) as f:
            for raw in f:
                line = raw.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())
    except Exception as exc:  # pragma: no cover
        print(f"⚠️  .env load failed: {exc}")


# ── Database ──────────────────────────────────────────────────────────────────

def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME", "nba_stats"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
    )


def fetch_team_facts(conn, season: str) -> list[dict]:
    """
    Return one random qualifying top-5 fact per team.

    Uses DISTINCT ON (team_id) with ORDER BY RANDOM() so each call may
    return a different stat — exactly like the DidYouKnow component.
    """
    excluded = tuple(EXCLUDED_CATEGORIES)
    sql = """
        SELECT DISTINCT ON (r.team_id)
            r.team_id,
            r.stat_category,
            r.rank,
            r.value,
            t.team_name,
            t.abbreviation,
            t.logo_url,
            t.team_colors->>'primary'   AS primary_color,
            t.team_colors->>'secondary' AS secondary_color
        FROM stat_rankings r
        JOIN teams t ON r.team_id = t.team_id
        WHERE r.rank <= 5
          AND r.season = %s
          AND r.stat_category NOT IN %s
        ORDER BY r.team_id, RANDOM()
    """
    with conn.cursor() as cur:
        cur.execute(sql, (season, excluded))
        cols = [desc[0] for desc in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]

    # Attach human-readable label from STAT_LABELS mapping
    for row in rows:
        row["label"] = STAT_LABELS.get(row["stat_category"], row["stat_category"])
    return rows


# ── Color helpers ─────────────────────────────────────────────────────────────

def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def luminance(r: int, g: int, b: int) -> float:
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def get_team_bg_color(team_id: int, primary: str, secondary: str) -> str:
    """
    Return the background hex color for a team card.

    Mirrors the DidYouKnow / TeamCard algorithm:
      - Jazz and Rockets always use secondary.
      - Dark primary (luminance < 0.5) → primary.
      - Light primary → secondary.
    """
    if team_id in SECONDARY_OVERRIDE_IDS:
        return secondary
    r, g, b = hex_to_rgb(primary)
    return primary if luminance(r, g, b) < 0.5 else secondary


# ── Text helpers ──────────────────────────────────────────────────────────────

def ordinal(n: int) -> str:
    """Return English ordinal string: 1 → '1st', 2 → '2nd', etc."""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def draw_centered(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    canvas_w: int = IMAGE_W,
) -> int:
    """Draw centered text and return the y-coordinate of the bottom edge."""
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = (canvas_w - w) // 2
    draw.text((x, y), text, font=font, fill=fill)
    return y + (bbox[3] - bbox[1])


def draw_wrapped_centered(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    max_w: int,
    line_spacing: int = 8,
) -> int:
    """Wrap text to fit max_w, draw centered, return bottom y."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if text_width(draw, test, font) <= max_w:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lh = bbox[3] - bbox[1]
        lw = bbox[2] - bbox[0]
        x = (IMAGE_W - lw) // 2
        draw.text((x, y), line, font=font, fill=fill)
        y += lh + line_spacing
    return y


# ── Logo download ─────────────────────────────────────────────────────────────

_logo_cache: dict[str, Image.Image] = {}


def get_png_logo_url(team_id: int) -> str:
    """
    Return PNG logo URL from NBA CDN.
    The DB stores SVG URLs, but we need PNG for Pillow compatibility.
    """
    return f"https://cdn.nba.com/logos/nba/{team_id}/global/L/logo.png"


def fetch_logo(team_id: int) -> Image.Image | None:
    """Download PNG logo from NBA CDN, using team_id to construct URL."""
    url = get_png_logo_url(team_id)
    if url in _logo_cache:
        return _logo_cache[url]
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        _logo_cache[url] = img
        return img
    except Exception as exc:
        print(f"  ⚠️  Logo download failed for team {team_id}: {exc}")
        return None


# ── Image composition ─────────────────────────────────────────────────────────

def compose_image(fact: dict) -> Image.Image:
    """Render a single 1080×1350 social image for one team/fact."""
    bg_hex = get_team_bg_color(
        fact["team_id"],
        fact["primary_color"] or "#000000",
        fact["secondary_color"] or "#FFFFFF",
    )
    bg_rgb = hex_to_rgb(bg_hex)

    img = Image.new("RGBA", (IMAGE_W, IMAGE_H), bg_rgb + (255,))

    # ── Layer 2: logo watermark ───────────────────────────────────────────────
    logo = fetch_logo(fact["team_id"])
    if logo:
        logo_size = 920
        logo_resized = logo.copy()
        logo_resized.thumbnail((logo_size, logo_size), Image.LANCZOS)
        # Build a faded version at 12% opacity
        r, g, b, a = logo_resized.split()
        a = a.point(lambda v: int(v * 0.12))
        logo_faded = Image.merge("RGBA", (r, g, b, a))
        lw, lh = logo_faded.size
        x = (IMAGE_W - lw) // 2
        y = (IMAGE_H - lh) // 2
        img.paste(logo_faded, (x, y), logo_faded)

    # ── Layer 3: dark overlay ─────────────────────────────────────────────────
    overlay = Image.new("RGBA", (IMAGE_W, IMAGE_H), (0, 0, 0, 210))
    img = Image.alpha_composite(img, overlay)

    # ── Layer 4: text ─────────────────────────────────────────────────────────
    draw = ImageDraw.Draw(img)

    font_gothic_sm = load_font(FONT_LEAGUE_GOTHIC, 42)
    font_gothic_lg = load_font(FONT_LEAGUE_GOTHIC, 84)
    font_jakarta_xl = load_font(FONT_JAKARTA_BOLD, 96)
    font_jakarta_lg = load_font(FONT_JAKARTA_BOLD, 76)
    font_jakarta_hero = load_font(FONT_JAKARTA_BOLD, 168)
    font_jakarta_md = load_font(FONT_JAKARTA_BOLD, 64)
    font_jakarta_sm = load_font(FONT_JAKARTA_BOLD, 40)

    white_90 = (255, 255, 255, 230)
    white_60 = (255, 255, 255, 153)
    white_40 = (255, 255, 255, 100)
    gold = (255, 215, 0, 255)

    pad = 64  # horizontal padding
    max_text_w = IMAGE_W - pad * 2

    # "NBA TOP FIVE IN" — small header
    y = 80
    draw_centered(draw, y, "NBA TOP FIVE IN", font_gothic_sm, white_60)

    # "DID YOU KNOW..." — large tracked header
    y = 148
    draw_centered(draw, y, "DID YOU KNOW...", font_gothic_lg, white_90)

    # Divider
    y = 278
    draw.line([(pad, y), (IMAGE_W - pad, y)], fill=white_40, width=2)

    # Team name
    y = 330
    team_text = f"The {fact['team_name']}"
    y = draw_wrapped_centered(draw, y, team_text, font_jakarta_xl, (255, 255, 255, 255), max_text_w, line_spacing=10)

    # "are ranked"
    y += 16
    draw_centered(draw, y, "are ranked", font_jakarta_lg, white_60)

    # Ordinal (gold hero)
    y += 100
    ord_text = ordinal(fact["rank"])
    draw_centered(draw, y, ord_text, font_jakarta_hero, gold)

    # "in {label}"
    y += 200
    label_text = f"in {fact['label']}"
    y = draw_wrapped_centered(draw, y, label_text, font_jakarta_md, (255, 255, 255, 255), max_text_w, line_spacing=10)

    # Date — bottom
    date_str = date.today().strftime("%B %-d, %Y")
    draw_centered(draw, IMAGE_H - 80, date_str, font_jakarta_sm, white_40)

    return img.convert("RGB")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    load_env()

    season = os.environ.get("CURRENT_SEASON", "2025")

    conn = get_connection()
    try:
        facts = fetch_team_facts(conn, season)
    finally:
        conn.close()

    if not facts:
        print("⚠️  No qualifying facts found — check stat_rankings data.")
        sys.exit(1)

    today = date.today().isoformat()
    out_dir = OUTPUT_BASE / today
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"🖼️  Generating {len(facts)} social images → {out_dir}")
    errors = 0
    for fact in facts:
        abbr = fact["abbreviation"]
        try:
            img = compose_image(fact)
            out_path = out_dir / f"{abbr}.png"
            img.save(out_path, "PNG", optimize=True)
            print(f"  ✅ {abbr}: #{fact['rank']} in {fact['stat_category']}")
        except Exception as exc:
            print(f"  ❌ {abbr}: {exc}")
            errors += 1

    if errors:
        print(f"\n⚠️  {errors} image(s) failed.")
        sys.exit(1)
    else:
        print(f"\n✅ All {len(facts)} images saved to {out_dir}")


if __name__ == "__main__":
    main()
