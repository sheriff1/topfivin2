#!/usr/bin/env python3
"""
Extract team colors from NBA logo PNGs and populate team_colors in database.
Reusable utility to extract and validate team colors from logos using K-means clustering
and WCAG AAA contrast validation. Can use local PNG files or download logos from CDN.

Usage:
    # Download PNGs from CDN
    python extract_colors_from_logos.py
    
    # Use local PNG files (converted from SVG)
    python extract_colors_from_logos.py --png-dir /path/to/png/directory

Can be run anytime logos are updated to re-extract and refresh team colors.
"""

import os
import sys
import time
import colorsys
import argparse
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
    import psycopg2
    import psycopg2.extras
    from sklearn.cluster import KMeans
    import numpy as np
    import requests
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("Install with: pip install pillow psycopg2-binary scikit-learn numpy requests")
    sys.exit(1)

# Import shared configuration and constants
from config import NBA_TEAMS, NBA_CDN_BASE

# Database configuration from environment variables
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'nba_stats')


def rgb_to_hex(r, g, b):
    """Convert RGB values (0-255) to hex color string"""
    return f"#{int(r):02x}{int(g):02x}{int(b):02x}".upper()


def hex_to_rgb(hex_color):
    """Convert hex color string to RGB tuple (0-255)"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_luminance(hex_color):
    """
    Calculate WCAG 2.0 relative luminance for a hex color.
    
    Formula (https://www.w3.org/TR/WCAG20/#relativeluminancedef):
    1. Convert RGB (0-255) to sRGB (0.0-1.0)
    2. Apply gamma correction:
       - If RsRGB ≤ 0.03928: R = RsRGB / 12.92
       - Else: R = ((RsRGB + 0.055) / 1.055) ^ 2.4
       - Same for G and B
    3. Luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B
    
    Result is a value between 0 (black) and 1 (white).
    """
    r, g, b = hex_to_rgb(hex_color)
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    
    rs = r / 12.92 if r <= 0.03928 else ((r + 0.055) / 1.055) ** 2.4
    gs = g / 12.92 if g <= 0.03928 else ((g + 0.055) / 1.055) ** 2.4
    bs = b / 12.92 if b <= 0.03928 else ((b + 0.055) / 1.055) ** 2.4
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs


def get_contrast_ratio(color1, color2):
    """
    Calculate WCAG 2.0 contrast ratio between two colors.
    
    Formula (https://www.w3.org/TR/WCAG20/#contrast-ratiodef):
    ContrastRatio = (L1 + 0.05) / (L2 + 0.05)
    where L1 is the luminance of lighter color, L2 is luminance of darker color.
    
    Result ranges from 1:1 (no contrast) to 21:1 (maximum contrast).
    WCAG AAA requires 7:1 for normal text, 4.5:1 for large text.
    This function targets 7:1 for team colors.
    """
    l1 = get_luminance(color1)
    l2 = get_luminance(color2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def adjust_color_for_wcag(hex_color, target_ratio=7.0, max_iterations=50):
    """
    Adjust a color to meet WCAG AAA contrast ratio (7:1) with black or white.
    
    Algorithm:
    1. Check if color already meets 7:1 with black (#000000) or white (#FFFFFF)
    2. If not, convert to HSL color space
    3. Try darkening (decrease lightness) to improve contrast with white
    4. If that fails, try lightening (increase lightness) to improve contrast with black
    5. If still not compliant, return pure black or white (whichever gives better ratio)
    
    Uses HSL space because lightness is the primary factor affecting luminance/contrast.
    """
    contrast_with_black = get_contrast_ratio(hex_color, '#000000')
    contrast_with_white = get_contrast_ratio(hex_color, '#FFFFFF')
    
    # If already compliant with either black or white, return as-is
    if contrast_with_black >= target_ratio or contrast_with_white >= target_ratio:
        return hex_color
    
    # Convert to HSL and adjust lightness
    r, g, b = hex_to_rgb(hex_color)
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
    
    # Try darkening first (decrease lightness)
    for i in range(max_iterations):
        l_adjusted = l - (0.02 * (i + 1))
        if l_adjusted < 0:
            break
        
        r_adj, g_adj, b_adj = colorsys.hls_to_rgb(h, l_adjusted, s)
        adjusted_hex = rgb_to_hex(r_adj * 255, g_adj * 255, b_adj * 255)
        
        if get_contrast_ratio(adjusted_hex, '#FFFFFF') >= target_ratio:
            return adjusted_hex
    
    # If darkening didn't work, try lightening (increase lightness)
    for i in range(max_iterations):
        l_adjusted = l + (0.02 * (i + 1))
        if l_adjusted > 1:
            break
        
        r_adj, g_adj, b_adj = colorsys.hls_to_rgb(h, l_adjusted, s)
        adjusted_hex = rgb_to_hex(r_adj * 255, g_adj * 255, b_adj * 255)
        
        if get_contrast_ratio(adjusted_hex, '#000000') >= target_ratio:
            return adjusted_hex
    
    # If still not compliant, return pure black or white
    if get_contrast_ratio(hex_color, '#000000') > get_contrast_ratio(hex_color, '#FFFFFF'):
        return '#000000'
    else:
        return '#FFFFFF'


def download_logo(team_id, png_dir=None):
    """
    Load PNG logo from local file or download from NBA CDN.
    
    Args:
        team_id: NBA team ID
        png_dir: Optional local directory containing PNG files (e.g., from convert_svgs_to_pngs.py)
    
    Returns:
        PIL Image object or None if failed
    """
    # Try local file first
    if png_dir:
        local_path = os.path.join(png_dir, f"{team_id}.png")
        if os.path.exists(local_path):
            try:
                return Image.open(local_path)
            except Exception as e:
                print(f"  ❌ Failed to load local PNG: {e}")
                return None
    
    # Fall back to downloading PNG from NBA CDN
    url = f"{NBA_CDN_BASE}/{team_id}/primary/logo.png"
    try:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        time.sleep(0.5)
        response = session.get(url, timeout=10)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except Exception as e:
        print(f"  ❌ Failed to download: {e}")
        return None


def extract_dominant_colors(image, num_colors=3):
    """
    Extract dominant colors from an image using k-means clustering.
    Returns list of hex color strings.
    """
    try:
        # Convert to RGB if needed (handle RGBA, P mode, etc.)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Convert RGBA/LA to RGB with white background
            rgb_image = Image.new('RGB', image.size, (255, 255, 255))
            rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = rgb_image
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize for faster processing
        image.thumbnail((100, 100))
        
        # Convert image to array and reshape for clustering
        img_array = np.array(image)
        pixels = img_array.reshape((-1, 3))
        
        # Apply k-means clustering
        kmeans = KMeans(n_clusters=min(num_colors, len(np.unique(pixels, axis=0))), random_state=42, n_init=10)
        kmeans.fit(pixels)
        
        # Get cluster centers (dominant colors)
        colors = kmeans.cluster_centers_.astype(int)
        
        # Convert to hex and sort by frequency (cluster size counts)
        hex_colors = []
        cluster_counts = [(c, np.sum(kmeans.labels_ == i)) for i, c in enumerate(colors)]
        cluster_counts.sort(key=lambda x: x[1], reverse=True)
        
        for color, _ in cluster_counts:
            hex_color = rgb_to_hex(color[0], color[1], color[2])
            if hex_color not in hex_colors:  # Avoid duplicates
                hex_colors.append(hex_color)
        
        return hex_colors[:num_colors]
    
    except Exception as e:
        print(f"  ❌ Color extraction failed: {e}")
        return []


def fill_missing_colors(colors):
    """
    Ensure we have 3 colors by filling missing ones with black/white.
    - If 1 color: add #000000 and #FFFFFF
    - If 2 colors: add #000000 or #FFFFFF (whichever contrasts better with primary)
    """
    if len(colors) >= 3:
        return colors[:3]
    
    colors = colors.copy()
    
    while len(colors) < 3:
        if len(colors) == 1:
            colors.append('#000000')  # Secondary = black
        elif len(colors) == 2:
            colors.append('#FFFFFF')  # Tertiary = white
    
    return colors


def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except psycopg2.Error as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def update_team_colors(conn, team_id, colors):
    """Update team_colors in database"""
    try:
        color_json = {
            'primary': colors[0],
            'secondary': colors[1],
            'tertiary': colors[2]
        }
        
        cur = conn.cursor()
        cur.execute(
            "UPDATE teams SET team_colors = %s WHERE team_id = %s",
            (psycopg2.extras.Json(color_json), team_id)
        )
        conn.commit()
        cur.close()
        return True
    except psycopg2.Error as e:
        print(f"  ❌ Database update failed: {e}")
        return False


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description='Extract team colors from NBA logos and populate database'
    )
    parser.add_argument(
        '--png-dir',
        type=str,
        default=None,
        help='Directory containing local PNG files (e.g., from convert_svgs_to_pngs.py)'
    )
    args = parser.parse_args()
    
    print("🎨 NBA Team Logo Color Extractor")
    print("=" * 50)
    
    if args.png_dir:
        print(f"📁 Using local PNG directory: {args.png_dir}")
        if not os.path.isdir(args.png_dir):
            print(f"❌ Directory not found: {args.png_dir}")
            sys.exit(1)
    else:
        print("📥 Downloading PNGs from NBA CDN")
    
    conn = connect_db()
    print(f"✓ Connected to database {DB_NAME}")
    
    successful = 0
    failed = 0
    
    for team_id, team_name in sorted(NBA_TEAMS.items()):
        print(f"\n📥 {team_name}...", end=" ", flush=True)
        
        # Load/download logo
        image = download_logo(team_id, png_dir=args.png_dir)
        if not image:
            print("❌ Load failed")
            failed += 1
            continue
        
        # Extract colors
        colors = extract_dominant_colors(image, num_colors=3)
        if not colors:
            print("❌ Color extraction failed")
            failed += 1
            continue
        
        # Fill missing colors
        colors = fill_missing_colors(colors)
        
        # Apply WCAG adjustment
        adjusted_colors = [
            adjust_color_for_wcag(colors[0]),  # Primary
            adjust_color_for_wcag(colors[1]),  # Secondary
            colors[2]  # Tertiary (no adjustment, often black/white already)
        ]
        
        # Update database
        if update_team_colors(conn, team_id, adjusted_colors):
            print(f"✅ {adjusted_colors[0]}, {adjusted_colors[1]}, {adjusted_colors[2]}")
            successful += 1
        else:
            failed += 1
    
    conn.close()
    
    print("\n" + "=" * 50)
    print(f"✅ Complete: Updated {successful}/30 teams")
    if failed > 0:
        print(f"⚠️  Failed: {failed} teams")


if __name__ == '__main__':
    main()
