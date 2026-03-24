const { z } = require("zod");

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const TeamRowSchema = z.object({
  id: z.number().int(),
  team_id: z.number().int(),
  team_name: z.string(),
  logo_url: z.string().nullable(),
  team_colors: z.unknown().nullable(),
  trophy_count: z.number().int(),
});

const RankingItemSchema = z.object({
  team_id: z.number().int(),
  team_name: z.string(),
  stat_category: z.string(),
  rank: z.number().int(),
  value: z.number(),
  logo_url: z.string().nullable(),
  games_count: z.number().int(),
});

const TeamGameStatsSchema = z.object({
  game_id: z.string(),
  game_date: z.string(),
  team_id: z.number().int(),
  abbreviation: z.string(),
  logo_url: z.string().nullable(),
  pts: z.number(),
  reb: z.number(),
  ast: z.number(),
  stl: z.number(),
  blk: z.number(),
  fg_pct: z.number(),
  ft_pct: z.number(),
  three_p_pct: z.number(),
  fg: z.number(),
  fga: z.number(),
  ft: z.number(),
  fta: z.number(),
  three_p: z.number(),
  three_pa: z.number(),
});

const TeamStatsObjectSchema = z.object({
  fg: z.number(),
  fga: z.number(),
  fg_pct: z.number(),
  three_p: z.number(),
  three_pa: z.number(),
  three_p_pct: z.number(),
  ft: z.number(),
  fta: z.number(),
  ft_pct: z.number(),
  oreb: z.number(),
  dreb: z.number(),
  reb: z.number(),
  ast: z.number(),
  tov: z.number(),
  stl: z.number(),
  blk: z.number(),
  pf: z.number(),
  pts: z.number(),
  fg_avg: z.number(),
  fga_avg: z.number(),
  three_p_avg: z.number(),
  reb_avg: z.number(),
  ast_avg: z.number(),
  tov_avg: z.number(),
  stl_avg: z.number(),
  blk_avg: z.number(),
  pts_avg: z.number(),
  orb_pct: z.number().nullable(),
  drb_pct: z.number().nullable(),
  trb_pct: z.number().nullable(),
  ast_pct: z.number().nullable(),
  tov_pct: z.number().nullable(),
  usg_pct: z.number().nullable(),
  ts_pct: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// Endpoint response schemas
// ---------------------------------------------------------------------------

const HealthResponseSchema = z.object({
  status: z.literal("healthy"),
  timestamp: z.string().datetime(),
  api: z.literal("ok"),
});

const CategoriesResponseSchema = z.object({
  success: z.literal(true),
  categories: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
    })
  ),
});

const RankingsResponseSchema = z.object({
  success: z.literal(true),
  rankings: z.array(RankingItemSchema),
  category: z.string(),
  label: z.string(),
  cached: z.boolean(),
  fetched_at: z.string().datetime().optional(),
  cached_at: z.string().datetime().optional(),
});

const TeamsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(TeamRowSchema),
});

const TeamByAbbrResponseSchema = z.object({
  success: z.literal(true),
  data: TeamRowSchema,
});

const TeamStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    team_id: z.number().int(),
    team_name: z.string(),
    season: z.union([z.number().int(), z.string()]),
    games_played: z.number().int(),
    stats: TeamStatsObjectSchema,
  }),
});

const TeamRankingsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    team_name: z.string(),
    rankings: z.array(
      z.object({
        stat_category: z.string(),
        rank: z.number().int(),
        value: z.number(),
      })
    ),
  }),
});

const AuditGamesResponseSchema = z.object({
  success: z.literal(true),
  stats: z.object({
    season: z.union([z.number(), z.string()]),
    total_games: z.union([z.number(), z.string()]),
    collected_games: z.union([z.number(), z.string()]),
    collection_percentage: z.union([z.number(), z.string()]),
  }),
  games: z.array(z.record(z.string(), z.unknown())),
  pagination: z.object({
    limit: z.number().int(),
    offset: z.number().int(),
    total: z.number().int(),
  }),
});

const AuditGameStatsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    game_id: z.string(),
    game_date: z.string(),
    home: TeamGameStatsSchema,
    away: TeamGameStatsSchema.nullable(),
  }),
});

module.exports = {
  HealthResponseSchema,
  CategoriesResponseSchema,
  RankingsResponseSchema,
  TeamsResponseSchema,
  TeamByAbbrResponseSchema,
  TeamStatsResponseSchema,
  TeamRankingsResponseSchema,
  AuditGamesResponseSchema,
  AuditGameStatsResponseSchema,
};
