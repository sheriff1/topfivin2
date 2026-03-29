"""
Unit tests for generate_social_images.py helper functions.

These tests are pure-Python and require no database or network access.
Run with:
    source .venv/bin/activate
    python -m pytest backend/scripts/tests/test_generate_social_images.py -v
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Make the scripts package importable from the repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from generate_social_images import (  # noqa: E402
    SECONDARY_OVERRIDE_IDS,
    get_team_bg_color,
    hex_to_rgb,
    luminance,
    ordinal,
    text_width,
)


# ── hex_to_rgb ─────────────────────────────────────────────────────────────────

class TestHexToRgb:
    def test_black(self):
        assert hex_to_rgb("#000000") == (0, 0, 0)

    def test_white(self):
        assert hex_to_rgb("#ffffff") == (255, 255, 255)

    def test_without_hash(self):
        assert hex_to_rgb("FF0000") == (255, 0, 0)

    def test_mixed(self):
        assert hex_to_rgb("#1D428A") == (29, 66, 138)


# ── luminance ──────────────────────────────────────────────────────────────────

class TestLuminance:
    def test_black_is_zero(self):
        assert luminance(0, 0, 0) == pytest.approx(0.0)

    def test_white_is_one(self):
        assert luminance(255, 255, 255) == pytest.approx(1.0)

    def test_dark_color_below_threshold(self):
        # Navy blue — should be considered dark
        r, g, b = hex_to_rgb("#1D428A")
        assert luminance(r, g, b) < 0.5

    def test_light_color_above_threshold(self):
        # Light gold — should be considered light
        r, g, b = hex_to_rgb("#FFC200")
        assert luminance(r, g, b) >= 0.5


# ── ordinal ────────────────────────────────────────────────────────────────────

class TestOrdinal:
    def test_1st(self):
        assert ordinal(1) == "1st"

    def test_2nd(self):
        assert ordinal(2) == "2nd"

    def test_3rd(self):
        assert ordinal(3) == "3rd"

    def test_4th(self):
        assert ordinal(4) == "4th"

    def test_5th(self):
        assert ordinal(5) == "5th"

    def test_11th_exception(self):
        # 11, 12, 13 are exceptions to the st/nd/rd rule
        assert ordinal(11) == "11th"
        assert ordinal(12) == "12th"
        assert ordinal(13) == "13th"

    def test_21st(self):
        assert ordinal(21) == "21st"

    def test_22nd(self):
        assert ordinal(22) == "22nd"

    def test_23rd(self):
        assert ordinal(23) == "23rd"


# ── get_team_bg_color ──────────────────────────────────────────────────────────

class TestGetTeamBgColor:
    JAZZ_ID = 1610612762
    ROCKETS_ID = 1610612745
    CELTICS_ID = 1610612738  # dark primary → should use primary
    WARRIORS_ID = 1610612744  # yellow primary → should use secondary

    def test_jazz_always_secondary(self):
        result = get_team_bg_color(self.JAZZ_ID, "#002B5C", "#00471B")
        assert result == "#00471B"

    def test_rockets_always_secondary(self):
        result = get_team_bg_color(self.ROCKETS_ID, "#CE1141", "#000000")
        assert result == "#000000"

    def test_dark_primary_uses_primary(self):
        # Celtics primary navy #007A33 — luminance ≈ 0.19 (dark)
        result = get_team_bg_color(self.CELTICS_ID, "#007A33", "#FFFFFF")
        assert result == "#007A33"

    def test_light_primary_uses_secondary(self):
        # Warriors primary gold #FFC72C — luminance > 0.5 (light)
        result = get_team_bg_color(self.WARRIORS_ID, "#FFC72C", "#1D428A")
        assert result == "#1D428A"

    def test_secondary_override_set_contains_expected_ids(self):
        assert self.JAZZ_ID in SECONDARY_OVERRIDE_IDS
        assert self.ROCKETS_ID in SECONDARY_OVERRIDE_IDS


# ── text_width (smoke test — needs a real font) ────────────────────────────────

class TestTextWidth:
    def test_returns_positive_int(self):
        from PIL import ImageDraw, ImageFont, Image
        from generate_social_images import FONT_JAKARTA_BOLD

        if not FONT_JAKARTA_BOLD.exists():
            pytest.skip("Font file not present")

        img = Image.new("RGBA", (400, 100))
        draw = ImageDraw.Draw(img)
        font = ImageFont.truetype(str(FONT_JAKARTA_BOLD), 48)
        w = text_width(draw, "Hello", font)
        assert w > 0

    def test_longer_text_is_wider(self):
        from PIL import ImageDraw, ImageFont, Image
        from generate_social_images import FONT_JAKARTA_BOLD

        if not FONT_JAKARTA_BOLD.exists():
            pytest.skip("Font file not present")

        img = Image.new("RGBA", (600, 100))
        draw = ImageDraw.Draw(img)
        font = ImageFont.truetype(str(FONT_JAKARTA_BOLD), 48)
        short = text_width(draw, "Hi", font)
        long_ = text_width(draw, "Hello World", font)
        assert long_ > short
