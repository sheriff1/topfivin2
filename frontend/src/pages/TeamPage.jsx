import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function TeamPage() {
  const { teamId } = useParams();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setLoading(true);
        // Fetch team data using team_id query parameter
        const response = await fetch(`http://localhost:5001/api/teams?team_id=${teamId}`);
        if (!response.ok) throw new Error('Failed to fetch team data');
        
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          setTeamData(result.data[0]);
        } else {
          setError('Team not found');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Loading...</h1>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Error: {error || 'Team not found'}</h1>
      </div>
    );
  }

  const colors = teamData.team_colors || { primary: '#000000', secondary: '#FFFFFF', tertiary: '#808080' };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-4xl font-bold mb-2">{teamData.team_name}</h1>
      <p className="text-gray-600 mb-8">Team ID: {teamData.team_id}</p>

      {/* Logo */}
      {teamData.logo_url && (
        <div className="mb-8">
          <img 
            src={teamData.logo_url} 
            alt={teamData.team_name}
            className="h-32 w-auto"
          />
        </div>
      )}

      {/* Color Palette */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Color Palette</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Primary Color */}
          <div className="text-center">
            <div 
              className="w-full h-32 rounded-lg shadow-md border border-gray-300 mb-3"
              style={{ backgroundColor: colors.primary }}
              title={colors.primary}
            />
            <p className="text-sm text-gray-700 font-semibold">Primary</p>
            <p className="text-lg font-mono font-bold">{colors.primary}</p>
            <p className="text-xs text-gray-500 mt-1">
              {getContrastWithBlack(colors.primary) >= 7.0 
                ? '✓ AAA compliant' 
                : getContrastWithWhite(colors.primary) >= 7.0
                ? '✓ AAA compliant (vs white)'
                : 'May need adjustment'
              }
            </p>
          </div>

          {/* Secondary Color */}
          <div className="text-center">
            <div 
              className="w-full h-32 rounded-lg shadow-md border border-gray-300 mb-3"
              style={{ backgroundColor: colors.secondary }}
              title={colors.secondary}
            />
            <p className="text-sm text-gray-700 font-semibold">Secondary</p>
            <p className="text-lg font-mono font-bold">{colors.secondary}</p>
            <p className="text-xs text-gray-500 mt-1">
              {getContrastWithBlack(colors.secondary) >= 7.0 
                ? '✓ AAA compliant' 
                : getContrastWithWhite(colors.secondary) >= 7.0
                ? '✓ AAA compliant (vs white)'
                : 'May need adjustment'
              }
            </p>
          </div>

          {/* Tertiary Color */}
          <div className="text-center">
            <div 
              className="w-full h-32 rounded-lg shadow-md border border-gray-300 mb-3"
              style={{ backgroundColor: colors.tertiary }}
              title={colors.tertiary}
            />
            <p className="text-sm text-gray-700 font-semibold">Tertiary</p>
            <p className="text-lg font-mono font-bold">{colors.tertiary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate WCAG contrast ratio
function getLuminance(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1, color2) {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getContrastWithBlack(color) {
  return getContrastRatio(color, '#000000');
}

function getContrastWithWhite(color) {
  return getContrastRatio(color, '#FFFFFF');
}
