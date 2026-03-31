// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

export const mockCategories = [
  { code: "PPG", label: "Points Per Game" },
  { code: "RPG", label: "Rebounds Per Game" },
];

// BOS = 1610612738, BKN = 1610612751, LAL = 1610612747, MIA = 1610612748, DAL = 1610612742
export const mockTeams = [
  {
    id: 1,
    team_id: 1610612738,
    team_name: "Boston Celtics",
    logo_url: null,
    team_colors: { primary: "#006532", secondary: "#BA9553" },
  },
  {
    id: 2,
    team_id: 1610612751,
    team_name: "Brooklyn Nets",
    logo_url: null,
    team_colors: { primary: "#000000", secondary: "#FFFFFF" },
  },
  {
    id: 3,
    team_id: 1610612747,
    team_name: "Los Angeles Lakers",
    logo_url: null,
    team_colors: { primary: "#552583", secondary: "#FDB927" },
  },
  {
    id: 4,
    team_id: 1610612748,
    team_name: "Miami Heat",
    logo_url: null,
    team_colors: { primary: "#98002E", secondary: "#F9A01B" },
  },
  {
    id: 5,
    team_id: 1610612742,
    team_name: "Dallas Mavericks",
    logo_url: null,
    team_colors: { primary: "#00538C", secondary: "#002B5E" },
  },
];

export const mockRankingsPPG = {
  success: true,
  rankings: [
    {
      team_id: 1610612738,
      team_name: "Boston Celtics",
      stat_category: "PPG",
      rank: 1,
      value: 120.5,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612751,
      team_name: "Brooklyn Nets",
      stat_category: "PPG",
      rank: 2,
      value: 115.4,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612747,
      team_name: "Los Angeles Lakers",
      stat_category: "PPG",
      rank: 3,
      value: 112.8,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612748,
      team_name: "Miami Heat",
      stat_category: "PPG",
      rank: 10,
      value: 105.2,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612742,
      team_name: "Dallas Mavericks",
      stat_category: "PPG",
      rank: 15,
      value: 101.8,
      logo_url: null,
      games_count: 82,
    },
  ],
  category: "PPG",
  label: "Points Per Game",
  cached: false,
  fetched_at: new Date().toISOString(),
};

export const mockRankingsRPG = {
  success: true,
  rankings: [
    {
      team_id: 1610612751,
      team_name: "Brooklyn Nets",
      stat_category: "RPG",
      rank: 1,
      value: 48.2,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612747,
      team_name: "Los Angeles Lakers",
      stat_category: "RPG",
      rank: 2,
      value: 46.5,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612738,
      team_name: "Boston Celtics",
      stat_category: "RPG",
      rank: 4,
      value: 44.1,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612748,
      team_name: "Miami Heat",
      stat_category: "RPG",
      rank: 12,
      value: 40.3,
      logo_url: null,
      games_count: 82,
    },
    {
      team_id: 1610612742,
      team_name: "Dallas Mavericks",
      stat_category: "RPG",
      rank: 18,
      value: 38.1,
      logo_url: null,
      games_count: 82,
    },
  ],
  category: "RPG",
  label: "Rebounds Per Game",
  cached: false,
  fetched_at: new Date().toISOString(),
};

// BOS has 2 rankings with rank ≤ 5 (shows 2 trophies)
export const mockBOSRankings = {
  success: true,
  data: {
    team_name: "Boston Celtics",
    rankings: [
      { stat_category: "PPG", rank: 1, value: 120.5 },
      { stat_category: "RPG", rank: 4, value: 44.1 },
    ],
  },
};

// BKN has 1 ranking rank ≤ 5 (RPG rank=8 is > 5 so it doesn't count)
export const mockBKNRankings = {
  success: true,
  data: {
    team_name: "Brooklyn Nets",
    rankings: [
      { stat_category: "PPG", rank: 2, value: 115.4 },
      { stat_category: "RPG", rank: 8, value: 39.7 },
    ],
  },
};

export const mockBOSTeam = {
  success: true,
  data: {
    id: 1,
    team_id: 1610612738,
    team_name: "Boston Celtics",
    logo_url: null,
    team_colors: { primary: "#006532", secondary: "#BA9553" },
  },
};

export const mockBOSStats = {
  success: true,
  data: {
    team_id: 1610612738,
    team_name: "Boston Celtics",
    season: 2025,
    games_played: 82,
    stats: {
      fg: 1568,
      fga: 3350,
      fg_pct: 0.468,
      three_p: 700,
      three_pa: 1800,
      three_p_pct: 0.389,
      ft: 400,
      fta: 500,
      ft_pct: 0.8,
      oreb: 400,
      dreb: 1100,
      reb: 1500,
      ast: 2400,
      tov: 850,
      stl: 500,
      blk: 320,
      pf: 1150,
      pts: 9882,
      fg_avg: 19.1,
      fga_avg: 40.9,
      three_p_avg: 8.5,
      reb_avg: 18.3,
      ast_avg: 29.3,
      tov_avg: 10.4,
      stl_avg: 6.1,
      blk_avg: 3.9,
      pts_avg: 120.5,
      orb_pct: null,
      drb_pct: null,
      trb_pct: null,
      ast_pct: null,
      tov_pct: null,
      usg_pct: null,
      ts_pct: null,
    },
  },
};

export const mockAuditGames = {
  success: true,
  stats: {
    season: "2025",
    total_games: 100,
    collected_games: 82,
    collection_percentage: "82.00",
  },
  games: [
    {
      game_id: "g1",
      game_date: "2025-01-15T00:00:00.000Z",
      home_team_id: 1610612738,
      home_team_abbreviation: "BOS",
      home_team_logo: null,
      away_team_id: 1610612751,
      away_team_abbreviation: "BKN",
      away_team_logo: null,
      collected: true,
      created_at: "2025-01-15T00:00:00.000Z",
      updated_at: "2025-01-15T00:00:00.000Z",
    },
  ],
  pagination: { limit: 50, offset: 0, total: 100 },
};

export const mockGameStats = {
  success: true,
  data: {
    game_id: "g1",
    game_date: "2025-01-15T00:00:00.000Z",
    home: {
      game_id: "g1",
      game_date: "2025-01-15T00:00:00.000Z",
      team_id: 1610612738,
      abbreviation: "BOS",
      logo_url: null,
      pts: 112,
      reb: 48,
      ast: 28,
      stl: 9,
      blk: 5,
      fg_pct: 46.8,
      ft_pct: 80.0,
      three_p_pct: 38.5,
      fg: 40,
      fga: 86,
      ft: 20,
      fta: 25,
      three_p: 12,
      three_pa: 31,
    },
    away: {
      game_id: "g1",
      game_date: "2025-01-15T00:00:00.000Z",
      team_id: 1610612751,
      abbreviation: "BKN",
      logo_url: null,
      pts: 105,
      reb: 44,
      ast: 24,
      stl: 7,
      blk: 4,
      fg_pct: 43.5,
      ft_pct: 75.0,
      three_p_pct: 35.0,
      fg: 38,
      fga: 87,
      ft: 17,
      fta: 23,
      three_p: 12,
      three_pa: 34,
    },
  },
};

// ---------------------------------------------------------------------------
// Route setup helper — call at the start of each test
// ---------------------------------------------------------------------------

/**
 * Registers page.route() intercepts for all API endpoints.
 * Must be called before page.goto().
 * @param {import('@playwright/test').Page} page
 */
export async function setupApiMocks(page) {
  // Health endpoint (plain axios call to /health, not under /api)
  await page.route("**/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "healthy", timestamp: new Date().toISOString(), api: "ok" }),
    })
  );

  // /api/categories
  await page.route("**/api/categories", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, categories: mockCategories }),
    })
  );

  // /api/rankings/random-facts — must be registered before /api/rankings*
  await page.route("**/api/rankings/random-facts*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, facts: [] }),
    })
  );

  // /api/rankings?category=...  (matches all query param variants)
  await page.route("**/api/rankings?**", (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category");
    const data = category === "RPG" ? mockRankingsRPG : mockRankingsPPG;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });

  // /api/teams/abbr/:abbreviation — must be registered before /api/teams
  await page.route("**/api/teams/abbr/**", (route) => {
    const url = route.request().url();
    const abbr = url.split("/abbr/")[1]?.split("?")[0].toUpperCase();
    const teamData = abbr === "BOS" ? mockBOSTeam : mockBOSTeam; // default to BOS data
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(teamData),
    });
  });

  // /api/teams  (exact path, no suffix)
  await page.route("**/api/teams", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: mockTeams }),
    })
  );

  // /api/team/:teamId/stats  (regex for numeric team id)
  await page.route(/\/api\/team\/\d+\/stats/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockBOSStats),
    })
  );

  // /api/team/:teamId/rankings  (regex for numeric team id)
  await page.route(/\/api\/team\/\d+\/rankings/, (route) => {
    const url = route.request().url();
    const teamId = parseInt(url.match(/\/api\/team\/(\d+)\/rankings/)?.[1]);
    const data = teamId === 1610612738 ? mockBOSRankings : mockBKNRankings;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });

  // /api/audit/games*
  await page.route("**/api/audit/games*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockAuditGames),
    })
  );

  // /api/audit/game/:gameId/stats
  await page.route("**/api/audit/game/*/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockGameStats),
    })
  );
}
