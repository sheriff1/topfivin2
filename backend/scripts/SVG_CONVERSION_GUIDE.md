# SVG to PNG Conversion Setup Guide (Optional Reference)

## Overview

**Note**: This guide is provided for reference only. The color extraction pipeline works seamlessly without manual SVG conversion.

For most use cases, you can simply run:
```bash
python extract_colors_from_logos.py
```

This downloads PNG logos directly from the NBA CDN and extracts colors automatically. You only need this guide if you:
- Want to work with local PNG files for offline processing
- Are experiencing NBA CDN rate-limiting
- Need to debug or analyze individual logos

## Background

The SVG to PNG converter script allows you to batch-convert NBA team logo SVGs to PNGs locally for color extraction. While this can be useful in certain scenarios, the standard workflow uses direct CDN downloads with built-in retry logic.

See [README.md](./README.md) for the full team data sourcing and color extraction methodology.

## Setup

### Option 1: Install via Homebrew (macOS) - **RECOMMENDED**

```bash
# Install required system tools
brew install cairo librsvg poppler

# The converter script will automatically detect and use these
python scripts/convert_svgs_to_pngs.py
```

After installation, the tools can be verified:
```bash
which rsvg-convert  # Should show path
which pdftoppm      # Should show path
```

### Option 2: Use Docker

If system tools are not available, you can use Docker:

```bash
# No setup needed - Docker handles it
docker run -it --rm -v $(pwd):/app python:3.13-slim bash

# Inside container:
apt-get update && apt-get install -y librsvg2-bin poppler-utils
python scripts/convert_svgs_to_pngs.py
```

### Option 3: Manual SVG to PNG Conversion

If you prefer to convert manually:

1. **Open SVGs in a browser** and export as PNG:
   - Download all 30 team SVGs from `https://cdn.nba.com/logos/nba/{team_id}/primary/logo.svg`
   - Open each in a modern browser (Chrome, Safari, Firefox)
   - Right-click → Save As → PNG format
   - Save to a single directory

2. **Use online tools**:
   - Visit https://cloudconvert.com/svg-to-png or similar
   - Batch convert all SVG files to PNG

## Usage

### With System Tools Installed

```bash
# Step 1: Convert all SVGs to PNGs (temporary directory)
python scripts/convert_svgs_to_pngs.py

# Output will show temp directory path like: /var/folders/.../nba_logos_pngs_abc123

# Step 2: Extract colors using the PNG directory
python scripts/extract_colors_from_logos.py --png-dir /var/folders/.../nba_logos_pngs_abc123

# Step 3: Verify colors updated in database
psql -U postgres -d nba_stats -c "SELECT team_name, team_colors FROM teams WHERE team_id = 1610612738;"
```

### With Manual PNG Conversion

```bash
# After downloading/converting all 30 team PNGs to a directory:
python scripts/extract_colors_from_logos.py --png-dir /path/to/your/png/directory

# Clean up when done:
rm -rf /path/to/your/png/directory
```

### Fallback: Use Existing Colors

If you don't want to set up SVG conversion tools, the current hardcoded color palette is already in the database and working:

```bash
# Just use existing colors - no action needed
# View current colors:
psql -U postgres -d nba_stats -c "SELECT team_name, team_colors FROM teams LIMIT 5;"
```

## Troubleshooting

### "no library called cairo was found"

**Solution:** Install system libraries via Homebrew:
```bash
brew install cairo librsvg poppler
```

### "rsvg-convert not found"

**Solution:** Install librsvg:
```bash
# macOS
brew install librsvg

# Ubuntu/Debian
sudo apt-get install librsvg2-bin

# CentOS/RHEL
sudo yum install librsvg2
```

### Script hangs downloading SVGs

**Cause:** NBA CDN is rate-limiting or blocking
**Solution:** Use pre-downloaded PNGs or manual conversion instead

## Technical Details

### Conversion Tools Used (in order of preference)

1. **cairosvg** (Python) - Most reliable for vector graphics
2. **librsvg** (`rsvg-convert` command) + **poppler** (`pdftoppm`) - System tools
3. **ImageMagick** (`convert` command) - Alternative system tool
4. **Fallback** - Creates white PNG placeholder

### Color Extraction Process

1. Download/load PNG file
2. Resize to 100x100 pixels
3. Use k-means clustering to extract 3 dominant colors
4. Fill missing colors with `#000000` (black) or `#FFFFFF` (white)
5. Adjust colors to meet WCAG AAA contrast ratio (7:1)
6. Store in PostgreSQL as JSON

### Output Format

Colors stored as JSONB in database:
```json
{
  "primary": "#007a33",
  "secondary": "#ba3520",
  "tertiary": "#000000"
}
```

## Example Commands

```bash
# Check current state
psql -U postgres -d nba_stats -c "SELECT COUNT(*) as teams_with_colors FROM teams WHERE team_colors IS NOT NULL;"

# View a team's colors
psql -U postgres -d nba_stats -c "SELECT team_name, team_colors FROM teams WHERE team_id = 1610612738;"

# Update colors for a single team
python scripts/extract_colors_from_logos.py --png-dir /path/to/pngs

# Reset colors to null (to re-extract)
psql -U postgres -d nba_stats -c "UPDATE teams SET team_colors = NULL;"
```

## Next Steps

After conversion:
1. Colors will automatically display on `/teams/{teamId}` pages
2. Rankings table will show team colors
3. WCAG AAA compliance indicators visible on TeamPage

For more information, see:
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [NBA Design System](https://brand.nba.com/)
