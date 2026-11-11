const { getSeasons, getCurrentSeason, CACHE_KEY } = require("../services/seasonService");

const makeDb = (seasons) => ({
  query: jest.fn().mockResolvedValue({ rows: seasons.map((season) => ({ season })) }),
});
const makeCache = (initial = null) => ({
  get: jest.fn().mockResolvedValue(initial),
  set: jest.fn().mockResolvedValue("OK"),
});

describe("seasonService", () => {
  it("returns the latest season as current, newest first", async () => {
    const db = makeDb(["2026", "2025"]);
    expect(await getSeasons(db, makeCache())).toEqual({
      current: "2026",
      available: ["2026", "2025"],
    });
  });

  it("stringifies season values", async () => {
    expect(await getCurrentSeason(makeDb([2025]), makeCache())).toBe("2025");
  });

  it("returns null current and no seasons for an empty database, without caching", async () => {
    const cache = makeCache();
    expect(await getSeasons(makeDb([]), cache)).toEqual({ current: null, available: [] });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("caches the lookup and serves from cache", async () => {
    const db = makeDb(["2025"]);
    const cache = makeCache();
    await getSeasons(db, cache);
    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEY,
      { current: "2025", available: ["2025"] },
      300
    );

    const cached = { current: "2026", available: ["2026"] };
    db.query.mockClear();
    expect(await getSeasons(db, makeCache(cached))).toBe(cached);
    expect(db.query).not.toHaveBeenCalled();
  });
});
