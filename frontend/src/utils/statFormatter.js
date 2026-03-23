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

  // Check if this is "Avg Game Duration" - convert to H:MM:SS format
  if (categoryLabel && categoryLabel.includes("Avg Game Duration")) {
    return minutesToTimeFormat(value);
  }

  // Check if this is "Avg Attendance" - format as integer (no decimals)
  if (categoryLabel && categoryLabel === "Avg Attendance") {
    return Math.round(parseFloat(value)).toString();
  }

  // Detect if this is a percentage-based stat by checking if label contains "%"
  const isPercentage = categoryLabel && categoryLabel.includes("%");

  if (isPercentage) {
    // Format as percentage with 2 decimal places and % symbol
    return `${parseFloat(value).toFixed(2)}%`;
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
