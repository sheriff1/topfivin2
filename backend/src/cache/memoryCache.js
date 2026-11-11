const logger = require("../utils/logger");

// In-process TTL cache. Per instance, lost on restart. Data refreshes once a day,
// so a short TTL is how clients pick up fresh data after the daily derive.
const DEFAULT_TTL_SECONDS = 300;
const MAX_ENTRIES = 500;

const store = new Map(); // key -> { value, expiresAt }

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

/**
 * @param {string} key
 * @returns {Promise<any>} cached value or null
 */
async function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  logger.debug("Cache hit:", { key });
  return entry.value;
}

/**
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - seconds (default 300)
 * @returns {Promise<string>} "OK"
 */
async function set(key, value, ttl = DEFAULT_TTL_SECONDS) {
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    pruneExpired();
    if (store.size >= MAX_ENTRIES) {
      // Evict the oldest inserted entry (Map preserves insertion order)
      store.delete(store.keys().next().value);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  return "OK";
}

/**
 * @param {string} key
 * @returns {Promise<number>} number of keys deleted
 */
async function del(key) {
  return store.delete(key) ? 1 : 0;
}

/**
 * @param {string} pattern - glob with `*` wildcards, e.g. "nba:rankings:*"
 * @returns {Promise<number>} number of keys deleted
 */
async function deleteByPattern(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  let count = 0;
  for (const key of store.keys()) {
    if (regex.test(key)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

async function isConnected() {
  return true;
}

module.exports = { get, set, del, deleteByPattern, isConnected };
