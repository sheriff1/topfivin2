// "2025" -> "2025-26". Returns "" for a missing/invalid season.
export function formatSeasonLabel(season) {
  const year = parseInt(season, 10);
  if (Number.isNaN(year)) return "";
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}
