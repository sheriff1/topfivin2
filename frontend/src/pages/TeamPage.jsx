import { useParams } from 'react-router-dom';
import { useTeamByAbbreviation, useTeamStats, useTeamRankings, useCategories } from '../hooks/useApi';

export function TeamPage() {
  const { abbreviation } = useParams();
  const { data: team, isLoading: teamLoading } = useTeamByAbbreviation(abbreviation);
  const { data: stats, isLoading: statsLoading } = useTeamStats(team?.team_id, '2025');
  const { data: rankings, isLoading: rankingsLoading } = useTeamRankings(team?.team_id, '2025');
  const { data: categories } = useCategories();

  const isLoading = teamLoading || statsLoading || rankingsLoading;

  // Calculate contrast ratio for white text on a given hex color
  const getContrastRatio = (hexColor) => {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return contrast ratio with white (255, 255, 255)
    // Higher values mean lighter background (less contrast with white text)
    return luminance;
  };

  // Choose header color: primary if contrast is good, else secondary
  // Special case: Jazz and Rockets use secondary color
  const getHeaderColor = () => {
    if (!team?.team_colors) return '#000000';
    
    const primaryColor = team.team_colors.primary || '#000000';
    const secondaryColor = team.team_colors.secondary || '#FFFFFF';
    
    // Jazz (1610612762) and Rockets (1610612745) always use secondary color
    if (team.team_id === 1610612762 || team.team_id === 1610612745) {
      return secondaryColor;
    }
    
    // Luminance < 0.5 is dark enough for white text (good contrast)
    const contrastRatio = getContrastRatio(primaryColor);
    return contrastRatio < 0.5 ? primaryColor : secondaryColor;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="alert alert-error">
        <div>
          <span>Team not found: {abbreviation}</span>
        </div>
      </div>
    );
  }

  // Create a mapping of category code to rank info
  const rankingsByCategory = (rankings?.rankings || []).reduce((acc, r) => {
    acc[r.stat_category] = r;
    return acc;
  }, {});

  // Get stat value from stats object
  const getStatValue = (category) => {
    if (!stats) return '-';
    
    const statMap = {
      'PPG': stats.pts_avg,
      'RPG': stats.reb_avg,
      'APG': stats.ast_avg,
      'SPG': stats.stl_avg,
      'BPG': stats.blk_avg,
      'FG%': stats.fg_pct ? (stats.fg_pct * 100).toFixed(1) : '-',
      '3P%': stats.three_p_pct ? (stats.three_p_pct * 100).toFixed(1) : '-',
      'FT%': stats.ft_pct ? (stats.ft_pct * 100).toFixed(1) : '-',
      'TS%': stats.ts_pct ? (stats.ts_pct * 100).toFixed(1) : '-',
      'ORB%': stats.orb_pct ? (stats.orb_pct * 100).toFixed(1) : '-',
      'DRB%': stats.drb_pct ? (stats.drb_pct * 100).toFixed(1) : '-',
      'TRB%': stats.trb_pct ? (stats.trb_pct * 100).toFixed(1) : '-',
      'AST%': stats.ast_pct ? (stats.ast_pct * 100).toFixed(1) : '-',
      'USG%': stats.usg_pct ? (stats.usg_pct * 100).toFixed(1) : '-',
      'TOV%': stats.tov_pct ? (stats.tov_pct * 100).toFixed(1) : '-',
    };
    
    return statMap[category] || '-';
  };

  // Get category label
  const getCategoryLabel = (code) => {
    const category = categories?.find(c => c.code === code);
    return category?.label || code;
  };

  // Get badge styling based on rank
  const getRankBadgeColor = (rank) => {
    if (rank <= 5) return 'badge-success'; // Top 5
    if (rank <= 15) return 'badge-warning'; // Top 15
    return 'badge-error'; // Beyond top 15
  };

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div 
        className="card shadow-md"
        style={{ 
          backgroundColor: getHeaderColor(),
          color: 'white'
        }}
      >
        <div className="card-body">
          <div className="flex items-start gap-6">
            {team.logo_url && (
              <img 
                src={team.logo_url} 
                alt={team.team_name}
                className="h-24 w-24 object-contain"
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white">{team.team_name}</h1>
              <p className="text-white/70 text-lg mt-2">
                {stats?.games_played || 0} games played
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Rankings Table */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title mb-4">Season Stats & Rankings (2025)</h2>
          
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className="w-1/3">Stat Category</th>
                  <th className="text-right">Rank</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {categories?.map((category) => {
                  const ranking = rankingsByCategory[category.code];
                  const isTrophy = ranking?.rank <= 5;
                  
                  return (
                    <tr key={category.code}>
                      <td>
                        <div className="flex items-center gap-2">
                          {category.label}
                          {isTrophy && <span className="text-xl">🏆</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        {ranking ? (
                          <div className={`badge ${getRankBadgeColor(ranking.rank)}`}>
                            #{ranking.rank}
                          </div>
                        ) : (
                          <span className="text-base-content/50">-</span>
                        )}
                      </td>
                      <td className="text-right font-semibold">
                        {ranking ? 
                          (category.code.includes('%') ? 
                            ranking.value.toFixed(1) : 
                            ranking.value.toFixed(1))
                          : getStatValue(category.code)
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
