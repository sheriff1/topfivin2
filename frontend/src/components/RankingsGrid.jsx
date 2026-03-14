import { useRankings } from '../hooks/useApi';

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
                {item.team_name}
                {item.games_count > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({item.games_count} game{item.games_count !== 1 ? 's' : ''})
                  </span>
                )}
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
