/**
 * Unit tests for the migration runner (backend/migrations/index.js)
 */

const fs = require("fs");
const path = require("path");
const { runPendingMigrations, MIGRATIONS, MIGRATION_LOCK_KEY } = require("../../migrations");

/**
 * Fake database whose client records queries and keeps an in-memory
 * schema_migrations table.
 */
function createFakeDb({ appliedIds = [] } = {}) {
  const state = { applied: [...appliedIds], queries: [], released: false };
  const client = {
    query: jest.fn(async (text, params) => {
      state.queries.push({ text: text.trim(), params });
      if (/^SELECT id FROM schema_migrations/i.test(text.trim())) {
        return { rows: state.applied.map((id) => ({ id })) };
      }
      if (/^INSERT INTO schema_migrations/i.test(text.trim())) {
        state.applied.push(params[0]);
      }
      return { rows: [] };
    }),
    release: jest.fn(() => {
      state.released = true;
    }),
  };
  return { db: { getClient: jest.fn(async () => client) }, client, state };
}

function makeMigrations(ids, { failOn } = {}) {
  const calls = [];
  const migrations = ids.map((id) => ({
    id,
    run: jest.fn(async () => {
      calls.push(id);
      if (id === failOn) throw new Error(`boom ${id}`);
    }),
  }));
  return { migrations, calls };
}

describe("runPendingMigrations", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("applies every migration on a fresh database, in order, and records them", async () => {
    const { db, state } = createFakeDb();
    const { migrations, calls } = makeMigrations(["001_a", "002_b", "003_c"]);

    const applied = await runPendingMigrations({ db, migrations });

    expect(calls).toEqual(["001_a", "002_b", "003_c"]);
    expect(applied).toEqual(["001_a", "002_b", "003_c"]);
    expect(state.applied).toEqual(["001_a", "002_b", "003_c"]);
  });

  it("applies nothing when the database is already up to date", async () => {
    const { db } = createFakeDb({ appliedIds: ["001_a", "002_b"] });
    const { migrations, calls } = makeMigrations(["001_a", "002_b"]);

    const applied = await runPendingMigrations({ db, migrations });

    expect(calls).toEqual([]);
    expect(applied).toEqual([]);
  });

  it("applies only the pending migrations", async () => {
    const { db, state } = createFakeDb({ appliedIds: ["001_a"] });
    const { migrations, calls } = makeMigrations(["001_a", "002_b", "003_c"]);

    const applied = await runPendingMigrations({ db, migrations });

    expect(calls).toEqual(["002_b", "003_c"]);
    expect(applied).toEqual(["002_b", "003_c"]);
    expect(state.applied).toEqual(["001_a", "002_b", "003_c"]);
  });

  it("stops at a failing migration, records earlier ones, and rethrows", async () => {
    const { db, state } = createFakeDb();
    const { migrations, calls } = makeMigrations(["001_a", "002_b", "003_c"], {
      failOn: "002_b",
    });

    await expect(runPendingMigrations({ db, migrations })).rejects.toThrow("boom 002_b");

    expect(calls).toEqual(["001_a", "002_b"]);
    expect(state.applied).toEqual(["001_a"]);
    // progress is committed so the successful migration is not lost
    expect(state.queries.map((q) => q.text)).toContain("COMMIT");
  });

  it("takes a transaction-scoped advisory lock and releases the client", async () => {
    const { db, state } = createFakeDb();
    const { migrations } = makeMigrations(["001_a"]);

    await runPendingMigrations({ db, migrations });

    const texts = state.queries.map((q) => q.text);
    expect(texts[0]).toBe("BEGIN");
    expect(texts[1]).toMatch(/pg_advisory_xact_lock/);
    expect(state.queries[1].params).toEqual([MIGRATION_LOCK_KEY]);
    expect(texts[texts.length - 1]).toBe("COMMIT");
    expect(state.released).toBe(true);
  });

  it("releases the client even when the migration table setup fails", async () => {
    const { db, client, state } = createFakeDb();
    client.query.mockImplementationOnce(async () => ({ rows: [] })); // BEGIN
    client.query.mockImplementationOnce(async () => {
      throw new Error("lock failed");
    });
    const { migrations } = makeMigrations(["001_a"]);

    await expect(runPendingMigrations({ db, migrations })).rejects.toThrow("lock failed");
    expect(state.released).toBe(true);
  });
});

describe("migration registry", () => {
  it("registers every numbered migration file, in order, exactly once", () => {
    const dir = path.dirname(require.resolve("../../migrations"));
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{3}_.+\.js$/.test(f))
      .map((f) => f.replace(/\.js$/, ""))
      .sort();

    expect(MIGRATIONS.map((m) => m.id)).toEqual(files);
  });

  it("uses unique ids", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
