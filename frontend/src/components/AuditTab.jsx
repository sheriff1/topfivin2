import React, { useState, useEffect, useCallback } from 'react';
import GameStatsRow from './GameStatsRow';
import { apiClient } from '../hooks/useApi';

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

  // Expanded row states
  const [expandedGameId, setExpandedGameId] = useState(null);
  const [expandedStats, setExpandedStats] = useState(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState(null);

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
      
      const url = `/audit/games?${params.toString()}`;
      console.log('Fetching audit data from:', url);
      
      const response = await apiClient.get(url);
      const data = response.data;
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

  const fetchGameStats = useCallback(async (gameId) => {
    try {
      setExpandedLoading(true);
      setExpandedError(null);

      const response = await apiClient.get(`/audit/game/${gameId}/stats`);
      const data = response.data;

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch game stats');
      }

      setExpandedStats(data.data);
    } catch (err) {
      console.error(`Error fetching game stats for game ${gameId}:`, err);
      setExpandedError(err.message);
      setExpandedStats(null);
    } finally {
      setExpandedLoading(false);
    }
  }, []);

  const handleRowClick = useCallback(
    (gameId) => {
      if (expandedGameId === gameId) {
        // Collapse if clicking the same row
        setExpandedGameId(null);
        setExpandedStats(null);
        setExpandedError(null);
      } else {
        // Expand new row
        setExpandedGameId(gameId);
        fetchGameStats(gameId);
      }
    },
    [expandedGameId, fetchGameStats]
  );

  const handleRetry = useCallback(() => {
    if (expandedGameId) {
      fetchGameStats(expandedGameId);
    }
  }, [expandedGameId, fetchGameStats]);

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
            <table className="table table-compact table-fixed w-full">
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
                    <React.Fragment key={game.game_id}>
                      <tr
                        onClick={() => handleRowClick(game.game_id)}
                        className={`cursor-pointer hover:bg-base-300 transition-colors ${
                          expandedGameId === game.game_id ? 'bg-base-300' : ''
                        }`}
                      >
                        <td className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedGameId === game.game_id ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            {game.game_id}
                          </div>
                        </td>
                        <td>
                          {game.game_date ? (() => {
                            const [year, month, day] = game.game_date.split('-');
                            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
                          })() : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {game.home_team_logo && (
                              <img 
                                src={game.home_team_logo} 
                                alt={`${game.home_team_abbreviation} logo`} 
                                className="h-6 w-6 object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <span>{game.home_team_abbreviation || '—'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {game.away_team_logo && (
                              <img 
                                src={game.away_team_logo} 
                                alt={`${game.away_team_abbreviation} logo`} 
                                className="h-6 w-6 object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <span>{game.away_team_abbreviation || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {game.collected ? (
                            <span className="badge badge-success">✓ Collected</span>
                          ) : (
                            <span className="badge badge-warning">⊘ Missing</span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Game Stats Row */}
                      {expandedGameId === game.game_id && (
                        <GameStatsRow
                          homeStats={expandedStats?.home}
                          awayStats={expandedStats?.away}
                          isLoading={expandedLoading}
                          error={expandedError}
                          onRetry={handleRetry}
                        />
                      )}
                    </React.Fragment>
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
