import { Link } from 'react-router-dom';
import { useRankings } from '../hooks/useApi';

const TEAM_ID_TO_ABBR = {
  1610612737: 'ATL', 1610612738: 'BOS', 1610612739: 'CLE', 1610612740: 'NOP',
  1610612741: 'CHI', 1610612742: 'DAL', 1610612743: 'DEN', 1610612744: 'GSW',
  1610612745: 'HOU', 1610612746: 'LAC', 1610612747: 'LAL', 1610612748: 'MIA',
  1610612749: 'MIL', 1610612750: 'MIN', 1610612751: 'BKN', 1610612752: 'NYK',
  1610612753: 'ORL', 1610612754: 'IND', 1610612755: 'PHI', 1610612756: 'PHX',
  1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612760: 'OKC',
  1610612761: 'TOR', 1610612762: 'UTA', 1610612763: 'MEM', 1610612764: 'WAS',
  1610612765: 'DET', 1610612766: 'CHA',
};

export function RankingsGrid({ category, season = '2025' }) {
  const { data, isLoading, error } = useRankings(category, season);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Error loading rankings: {error.message}</span>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>No data available for {category}</span>
      </div>
    );
  }

  const getRankColor = (rank) => {
    if (rank <= 5) return 'badge-success';
    if (rank <= 15) return 'badge-warning';
    return 'badge-error';
  };

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th className="text-right">{data.label}</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((item) => (
            <tr key={`${item.team_id}-${item.stat_category}`}>
              <td>
                <span className={`badge badge-lg ${getRankColor(item.rank)}`}>
                  #{item.rank}
                </span>
              </td>
              <td className="font-medium">
                <Link to={`/team/${TEAM_ID_TO_ABBR[item.team_id]}`} className="link link-hover">
                  <div className="flex items-center gap-3">
                    {item.logo_url && (
                      <img 
                        src={item.logo_url} 
                        alt={`${item.team_name} logo`} 
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          // Hide image if CDN URL fails to load
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      {item.team_name}
                      {item.games_count > 0 && (
                        <span className="text-sm text-gray-500 ml-2">
                          ({item.games_count} game{item.games_count !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="text-right text-lg font-bold">
                {typeof item.value === 'number'
                  ? item.value.toFixed(item.stat_category.includes('%') ? 1 : 2)
                  : item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
