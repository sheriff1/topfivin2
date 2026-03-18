import React from "react";
import { formatStatValue } from "../utils/statFormatter";

/**
 * GameStatsRow Component
 * Displays aggregated game stats for both teams in a 3-column layout
 * Props:
 *   - homeStats: { abbreviation, logo_url, pts, reb, ast, stl, blk, fg, fga, fg_pct, ft, fta, ft_pct, three_p, three_pa, three_p_pct }
 *   - awayStats: same structure as homeStats
 *   - isLoading: boolean indicating if stats are being fetched
 *   - error: error message string (if any)
 *   - onRetry: callback function to retry fetching stats
 */
const GameStatsRow = ({ homeStats, awayStats, isLoading, error, onRetry }) => {
  if (isLoading) {
    return (
      <tr className="bg-base-200">
        <td colSpan="5" className="text-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr className="bg-base-200">
        <td colSpan="5">
          <div className="p-6 text-center">
            <p className="text-error mb-4">{error}</p>
            <button
              onClick={onRetry}
              className="btn btn-sm btn-outline btn-error"
            >
              Retry
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (!homeStats || !awayStats) {
    return null;
  }

  // Helper function to format percentages using centralized formatter
  const formatPercent = (value) => {
    if (value === null || value === undefined) return "—";
    // Game stats percentages are already on 0-100 scale
    return formatStatValue(value, "Percentage %");
  };

  // Helper function to format counting stats using centralized formatter
  const formatStat = (value) => {
    if (value === null || value === undefined) return "—";
    return value;
  };

  const StatRow = ({ label, homeValue, awayValue }) => (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 py-2 border-b border-base-300 last:border-0 px-4">
      <div className="text-right font-semibold">{homeValue}</div>
      <div className="text-center text-sm font-medium min-w-[140px]">
        {label}
      </div>
      <div className="text-left font-semibold">{awayValue}</div>
    </div>
  );

  return (
    <tr className="bg-base-200">
      <td colSpan="5" className="p-0">
        <div className="p-6 space-y-1 max-w-lg mx-auto">
          {/* Team Names with Logos */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 py-2 border-b border-base-300 px-4">
            <div className="text-right font-semibold flex items-center justify-end gap-2">
              {homeStats.logo_url && (
                <img
                  src={homeStats.logo_url}
                  alt={`${homeStats.abbreviation} logo`}
                  className="h-6 w-6 object-contain"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              )}
              <span>{homeStats.abbreviation || "—"}</span>
            </div>
            <div className="text-center text-sm font-medium min-w-[140px]">
              Team
            </div>
            <div className="text-left font-semibold flex items-center gap-2">
              <span>{awayStats.abbreviation || "—"}</span>
              {awayStats.logo_url && (
                <img
                  src={awayStats.logo_url}
                  alt={`${awayStats.abbreviation} logo`}
                  className="h-6 w-6 object-contain"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              )}
            </div>
          </div>

          {/* Points */}
          <StatRow
            label="Points"
            homeValue={formatStat(homeStats.pts)}
            awayValue={formatStat(awayStats.pts)}
          />

          {/* Field Goals */}
          <StatRow
            label="Field goals"
            homeValue={`${formatStat(homeStats.fg)}/${formatStat(homeStats.fga)}`}
            awayValue={`${formatStat(awayStats.fg)}/${formatStat(awayStats.fga)}`}
          />

          {/* Field Goal % */}
          <StatRow
            label="Field goal %"
            homeValue={formatPercent(homeStats.fg_pct)}
            awayValue={formatPercent(awayStats.fg_pct)}
          />

          {/* 3-Pointers */}
          <StatRow
            label="3-pointers"
            homeValue={`${formatStat(homeStats.three_p)}/${formatStat(homeStats.three_pa)}`}
            awayValue={`${formatStat(awayStats.three_p)}/${formatStat(awayStats.three_pa)}`}
          />

          {/* 3-Point % */}
          <StatRow
            label="3-point %"
            homeValue={formatPercent(homeStats.three_p_pct)}
            awayValue={formatPercent(awayStats.three_p_pct)}
          />

          {/* Free Throws */}
          <StatRow
            label="Free throws"
            homeValue={`${formatStat(homeStats.ft)}/${formatStat(homeStats.fta)}`}
            awayValue={`${formatStat(awayStats.ft)}/${formatStat(awayStats.fta)}`}
          />

          {/* Free Throw % */}
          <StatRow
            label="Free throw %"
            homeValue={formatPercent(homeStats.ft_pct)}
            awayValue={formatPercent(awayStats.ft_pct)}
          />

          {/* Rebounds */}
          <StatRow
            label="Rebounds"
            homeValue={formatStat(homeStats.reb)}
            awayValue={formatStat(awayStats.reb)}
          />

          {/* Assists */}
          <StatRow
            label="Assists"
            homeValue={formatStat(homeStats.ast)}
            awayValue={formatStat(awayStats.ast)}
          />

          {/* Steals */}
          <StatRow
            label="Steals"
            homeValue={formatStat(homeStats.stl)}
            awayValue={formatStat(awayStats.stl)}
          />

          {/* Blocks */}
          <StatRow
            label="Blocks"
            homeValue={formatStat(homeStats.blk)}
            awayValue={formatStat(awayStats.blk)}
          />
        </div>
      </td>
    </tr>
  );
};

export default GameStatsRow;
