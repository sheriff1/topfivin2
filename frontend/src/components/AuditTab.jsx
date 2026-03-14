import { useState, useEffect, useCallback } from 'react';

export function AuditTab({ season }) {
  // Only 2025-26 season data available
  const auditSeason = '2025';
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all'); // all, collected, missing
  const [dateFilter, setDateFilter] = useState('');

  const fetchAuditData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build query parameters
      const params = new URLSearchParams({
        season: auditSeason,
        limit,
        offset,
      });
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (dateFilter) {
        params.append('date', dateFilter);
      }
      
      const url = `/api/audit/games?${params.toString()}`;
      console.log('Fetching audit data from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Audit data received:', data);
      
      if (!data.stats) {
        throw new Error('No stats in response');
      }
      
      // Convert string values to numbers
      const processedStats = {
        ...data.stats,
        total_games: parseInt(data.stats.total_games),
        collected_games: parseInt(data.stats.collected_games),
        collection_percentage: parseFloat(data.stats.collection_percentage)
      };
      setStats(processedStats);
      setGames(Array.isArray(data.games) ? data.games : []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Audit fetch error:', err);
      setError(err.message);
      setStats(null);
      setGames([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [auditSeason, limit, offset, statusFilter, dateFilter]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
  };

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <div>
          <span>Error loading audit data: {error}</span>
          <button className="btn btn-sm" onClick={fetchAuditData}>Retry</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (!stats) {
    return (
      <div className="alert alert-warning shadow-lg">
        <div>
          <span>No audit data available for 2025-26 season</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-lg">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select 
                className="select select-bordered"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="all">All Games</option>
                <option value="collected">Collected Only</option>
                <option value="missing">Missing Only</option>
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Date</span>
              </label>
              <input 
                type="date"
                className="input input-bordered"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            
            <div className="form-control flex flex-row items-end">
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('');
                  setOffset(0);
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Total Games</h3>
              <p className="text-3xl font-bold">{stats.total_games}</p>
            </div>
          </div>
          
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Collected</h3>
              <p className="text-3xl font-bold text-success">{stats.collected_games}</p>
            </div>
          </div>
          
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h3 className="card-title text-lg">Collection Rate</h3>
              <p className="text-3xl font-bold text-info">{stats.collection_percentage}%</p>
              <div className="progress progress-info mt-2">
                <div 
                  className="progress-value"
                  style={{ width: `${stats.collection_percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Games Table */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-lg">Game Collection Details</h3>
          
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th>Game ID</th>
                  <th>Date</th>
                  <th>Home Team</th>
                  <th>Away Team</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {games.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-gray-500">
                      No games found for season {season}
                    </td>
                  </tr>
                ) : (
                  games.map((game) => (
                    <tr key={game.game_id}>
                      <td className="font-mono text-sm">{game.game_id}</td>
                      <td>{new Date(game.game_date).toLocaleDateString()}</td>
                      <td>{game.home_team_name || '—'}</td>
                      <td>{game.away_team_name || '—'}</td>
                      <td>
                        {game.collected ? (
                          <span className="badge badge-success">✓ Collected</span>
                        ) : (
                          <span className="badge badge-warning">⊘ Missing</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm">
                Showing {offset + 1} to {Math.min(offset + limit, pagination.total)} of {pagination.total} games
              </div>
              
              <div className="join">
                <button
                  className="join-item btn"
                  disabled={offset === 0}
                  onClick={() => handlePageChange(Math.max(0, offset - limit))}
                >
                  ← Previous
                </button>
                
                <button className="join-item btn btn-disabled">
                  Page {Math.floor(offset / limit) + 1}
                </button>
                
                <button
                  className="join-item btn"
                  disabled={offset + limit >= pagination.total}
                  onClick={() => handlePageChange(offset + limit)}
                >
                  Next →
                </button>
              </div>

              <select
                className="select select-bordered select-sm"
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setOffset(0);
                }}
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="alert alert-info shadow-lg">
        <div>
          <span>
            💡 This audit shows which games have been successfully processed from the NBA API. 
            Missing games indicate API collection failures and may affect stat accuracy for those dates.
          </span>
        </div>
      </div>
    </div>
  );
}
