import { Link } from 'react-router-dom';
import { useTeamRankings } from '../hooks/useApi';

export function TeamCard({ team }) {
  const { data: rankingsData } = useTeamRankings(team.team_id);

  // Calculate trophy count (teams with rank <= 5)
  const trophyCount = rankingsData?.rankings?.filter(r => r.rank <= 5).length || 0;

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
    return luminance;
  };

  // Choose card color: primary if contrast is good, else secondary
  // Special case: Jazz use secondary color
  const getCardColor = () => {
    if (!team?.team_colors) return '#000000';
    
    const primaryColor = team.team_colors.primary || '#000000';
    const secondaryColor = team.team_colors.secondary || '#FFFFFF';
    
    // Jazz (team_id 1610612762) always use secondary color
    if (team.team_id === 1610612762) {
      return secondaryColor;
    }
    
    // Luminance < 0.5 is dark enough for white text
    const contrastRatio = getContrastRatio(primaryColor);
    return contrastRatio < 0.5 ? primaryColor : secondaryColor;
  };

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
      <div className="card shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
        {/* 4:3 aspect ratio container with team colors */}
        <div 
          className="aspect-video relative overflow-hidden"
          style={{ backgroundColor: getCardColor() }}
        >
          {team.logo_url && (
            <img 
              src={team.logo_url} 
              alt={team.team_name}
              className="w-full h-full object-contain p-4"
            />
          )}
        </div>

        {/* Card body */}
        <div className="card-body p-4 bg-base-200">
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
