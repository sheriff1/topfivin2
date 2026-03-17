import { Link } from 'react-router-dom';
import { useTeamRankings } from '../hooks/useApi';

export function TeamCard({ team }) {
  const { data: rankings } = useTeamRankings(team.team_id);

  // Calculate trophy count (teams with rank <= 5)
  const trophyCount = rankings?.filter(r => r.rank <= 5).length || 0;

  // Convert team_id to abbreviation - simple mapping
  // This is a frontend utility that mirrors the backend mapping
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

  const abbreviation = TEAM_ID_TO_ABBR[team.team_id];

  return (
    <Link to={`/team/${abbreviation}`}>
      <div className="card bg-base-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
        {/* 4:3 aspect ratio container */}
        <div className="aspect-video relative overflow-hidden bg-base-300">
          {team.logo_url && (
            <img 
              src={team.logo_url} 
              alt={team.team_name}
              className="w-full h-full object-contain p-4"
            />
          )}
        </div>

        {/* Card body */}
        <div className="card-body p-4">
          <h2 className="card-title text-lg line-clamp-1">
            {team.team_name}
          </h2>
          
          <div className="flex items-center gap-1 text-base">
            <span className="text-xl">🏆</span>
            <span className="font-semibold">×{trophyCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
