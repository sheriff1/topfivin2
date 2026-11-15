const { getDataStatus, CACHE_KEY } = require("../services/dataStatusService");

const makeCache = (initial = null) => ({
  get: jest.fn().mockResolvedValue(initial),
  set: jest.fn().mockResolvedValue("OK"),
});
// Query order: seasons lookup, then latest game date, then last fetched
const makeDb = ({
  seasons = ["2026"],
  latest = "2026-11-13",
  fetched = "2026-11-14T09:30:00Z",
}) => ({
  query: jest
    .fn()
    .mockResolvedValueOnce({ rows: seasons.map((season) => ({ season })) })
    .mockResolvedValueOnce({ rows: [{ latest_game_date: latest }] })
    .mockResolvedValueOnce({ rows: [{ last_fetched_at: fetched }] }),
});

describe("dataStatusService", () => {
  it("returns the current season's latest game date and last fetch time, and caches them", async () => {
    const db = makeDb({ seasons: ["2026", "2025"] });
    const cache = makeCache();
    const status = await getDataStatus(db, cache);
    expect(status).toEqual({
      season: "2026",
      latestGameDate: "2026-11-13",
      lastFetchedAt: "2026-11-14T09:30:00Z",
    });
    expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, status, 300);
  });

  it("only counts collected games for lastFetchedAt, never team_stats or stat_rankings", async () => {
    const db = makeDb({});
    await getDataStatus(db, makeCache());
    const sqls = db.query.mock.calls.map((c) => c[0]).join("\n");
    expect(sqls).toMatch(/FROM games WHERE season = \$1 AND collected = true/);
    expect(sqls).toMatch(/FROM game_stats WHERE season = \$1/);
    expect(db.query.mock.calls[1][0]).not.toMatch(/team_stats|stat_rankings/);
    expect(db.query.mock.calls[2][0]).not.toMatch(/team_stats|stat_rankings/);
  });

  it("returns null values when the season has no matching rows", async () => {
    const db = makeDb({ latest: null, fetched: null });
    expect(await getDataStatus(db, makeCache())).toEqual({
      season: "2026",
      latestGameDate: null,
      lastFetchedAt: null,
    });
  });

  it("returns null for an empty database, without caching", async () => {
    const cache = makeCache();
    expect(await getDataStatus(makeDb({ seasons: [] }), cache)).toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("serves from cache without querying", async () => {
    const cached = { season: "2026", latestGameDate: "2026-11-13", lastFetchedAt: null };
    const db = { query: jest.fn() };
    expect(await getDataStatus(db, makeCache(cached))).toBe(cached);
    expect(db.query).not.toHaveBeenCalled();
  });
});
