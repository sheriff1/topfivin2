import { useSeasonSelection } from "../hooks/useApi";
import { formatSeasonLabel } from "../utils/season";

// Dropdown to browse previous seasons. Hidden until at least two seasons are stored.
export function SeasonPicker() {
  const { season, available, setSeason } = useSeasonSelection();

  if (available.length < 2 || !season) return null;

  return (
    <label className="select select-sm text-base-content w-auto shrink-0">
      <span className="label">Season</span>
      <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season">
        {available.map((s) => (
          <option key={s} value={s}>
            {formatSeasonLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
