/**
 * Centralized utility for formatting stat values across all components
 * Ensures consistent decimal places and symbols for percentages
 */

/**
 * Convert decimal minutes to H:MM:SS format
 * @param {number} minutes - Decimal minutes (e.g., 125.44)
 * @returns {string} Formatted time string (e.g., "2:05:26")
 */
function minutesToTimeFormat(minutes) {
  const totalSeconds = Math.round(parseFloat(minutes) * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format a stat value for display
 * @param {number} value - The raw numeric value to format
 * @param {string} categoryLabel - The category label (e.g., "Field Goal %", "Points Per Game")
 * @returns {string} Formatted value (e.g., "45.67%" or "23.45")
 */
export function formatStatValue(value, categoryLabel) {
  // Handle null/undefined values
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }

  // Check if this is "Average Game Duration" (supports both old and new label formats)
  if (
    categoryLabel &&
    (categoryLabel.includes("Avg Game Duration") || categoryLabel.includes("Average Game Duration"))
  ) {
    return minutesToTimeFormat(value);
  }

  // Check if this is "Average Attendance" (supports both old and new label formats)
  if (
    categoryLabel &&
    (categoryLabel === "Average Attendance" || categoryLabel === "Avg Attendance")
  ) {
    return Math.round(parseFloat(value)).toString();
  }

  // Wins and Losses are always whole numbers
  if (categoryLabel && (categoryLabel === "Wins" || categoryLabel === "Losses")) {
    return Math.round(parseFloat(value)).toString();
  }

  // Detect if this is a percentage-based stat by checking if label contains "%"
  const isPercentage = categoryLabel && categoryLabel.includes("%");

  if (isPercentage) {
    // Some stats come from the API as 0-1 decimals (e.g., TS%, EFG%, contested_fg_pct)
    // while others are already 0-100 (e.g., FG%, 3P%). Normalize to 0-100 range.
    let pctValue = parseFloat(value);
    if (pctValue > 0 && pctValue < 1) {
      pctValue *= 100;
    }
    return `${pctValue.toFixed(2)}%`;
  } else {
    // Format as regular number with 2 decimal places
    return parseFloat(value).toFixed(2);
  }
}

/**
 * Format stat value for API responses that return percentages as 0-1 range
 * Multiplies by 100 before formatting
 * @param {number} value - The decimal value (0-1 range) to format
 * @param {string} categoryLabel - The category label (e.g., "Field Goal %")
 * @returns {string} Formatted percentage value
 */
export function formatPercentageStat(value, _categoryLabel) {
  // Handle null/undefined values
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }

  // Convert 0-1 range to 0-100 range
  const percentageValue = parseFloat(value) * 100;
  return `${percentageValue.toFixed(2)}%`;
}
