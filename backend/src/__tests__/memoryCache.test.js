const cache = require("../cache/memoryCache");

describe("memoryCache", () => {
  afterEach(async () => {
    jest.useRealTimers();
    await cache.deleteByPattern("*");
  });

  it("returns null on miss and the value on hit", async () => {
    expect(await cache.get("a")).toBeNull();
    await cache.set("a", { x: 1 });
    expect(await cache.get("a")).toEqual({ x: 1 });
  });

  it("expires entries after the TTL", async () => {
    jest.useFakeTimers();
    await cache.set("a", 1, 10);
    jest.advanceTimersByTime(9000);
    expect(await cache.get("a")).toBe(1);
    jest.advanceTimersByTime(2000);
    expect(await cache.get("a")).toBeNull();
  });

  it("del and deleteByPattern remove keys", async () => {
    await cache.set("nba:rankings:PPG:2025", 1);
    await cache.set("nba:rankings:RPG:2025", 2);
    await cache.set("other", 3);
    expect(await cache.del("other")).toBe(1);
    expect(await cache.del("other")).toBe(0);
    expect(await cache.deleteByPattern("nba:rankings:*")).toBe(2);
  });

  it("bounds the cache size by evicting the oldest entry", async () => {
    for (let i = 0; i < 501; i++) await cache.set(`k${i}`, i);
    expect(await cache.get("k0")).toBeNull();
    expect(await cache.get("k500")).toBe(500);
  });

  it("reports connected", async () => {
    expect(await cache.isConnected()).toBe(true);
  });
});
