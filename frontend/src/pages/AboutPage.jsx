export function AboutPage() {
  return (
    <div className="space-y-6">
      {/* About App */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-3xl mb-4">NBA Top Five In</h2>
          <p className="text-lg mb-4">
            A comprehensive NBA statistics dashboard providing live rankings and team performance
            metrics for the 2025-26 NBA season. Explore how teams stack up across 115+ statistical
            categories, from basic stats like points per game to advanced metrics like effective
            field goal percentage and player tracking data.
          </p>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Features:</h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Real-time rankings for 115+ NBA statistical categories</li>
              <li>Team-by-team performance breakdowns and comparisons</li>
              <li>Advanced metrics: ORtg, DRtg, pace, true shooting %, and more</li>
              <li>Sortable team statistics and rankings by category</li>
              <li>Game-level audit data for data verification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Data Accuracy */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">📊 Data Accuracy & Completeness</h2>

          <div className="space-y-4">
            <div className="bg-warning/10 p-4 rounded-lg border border-warning">
              <h3 className="font-semibold text-warning mb-2">⚠️ Known Data Gaps</h3>
              <p className="text-sm mb-3">
                7 games have permanently incomplete records in the NBA Stats API and are excluded
                from certain stat averages:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>
                  4 games missing BoxScoreSummaryV3 data (bench points, lead changes, pts from
                  turnovers)
                </li>
                <li>
                  3 games missing BoxScorePlayerTrackV3 data (distance, touches, contested shots)
                </li>
              </ul>
              <p className="text-sm mt-2">
                Impact is negligible — missing values are treated as 0 and represent less than 0.1%
                of each team&apos;s season average.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Data Sources</h3>
              <p className="text-sm mb-2">
                All statistics are sourced directly from the official NBA Stats API (stats.nba.com):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>
                  <strong>Traditional Stats:</strong> Points, rebounds, assists, FG%, FT%, 3P%
                </li>
                <li>
                  <strong>Advanced Stats:</strong> ORtg, DRtg, pace, true shooting %, player
                  efficiency rating (PER)
                </li>
                <li>
                  <strong>Four Factors:</strong> Effective FG%, turnover rate, offensive rebound %,
                  free throw rate
                </li>
                <li>
                  <strong>Misc Stats:</strong> Points in paint, fast break points, bench points
                </li>
                <li>
                  <strong>Player Tracking:</strong> Distance, touches, passes, contested shots
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Update Frequency</h3>
              <p className="text-sm">
                Statistics are updated after each game is completed and official box scores are
                published by the NBA. Processing typically occurs within hours of game completion.
              </p>
            </div>

            <div className="bg-success/10 p-4 rounded-lg border border-success">
              <h3 className="font-semibold text-success mb-2">✓ Verified Accuracy</h3>
              <p className="text-sm">
                All statistical calculations have been validated against official NBA box scores and
                the NBA Stats API. Rankings and team averages are calculated directly from verified
                game data.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-xl mb-3">Have Questions or Found an Issue?</h2>
          <p className="text-sm mb-4">
            If you notice inconsistencies in the data or have suggestions for improvements, please
            report them on our GitHub issues page.
          </p>
          <div className="flex gap-3">
            <a
              href="https://github.com/sheriff1/topfivin2"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
