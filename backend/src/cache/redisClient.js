const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null
 */
async function get(key) {
  try {
    const value = await redis.get(key);
    if (value) {
      console.log('Cache hit:', key);
      return JSON.parse(value);
    }
    console.log('Cache miss:', key);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default 3600 = 1 hour)
 * @returns {Promise<string>} - 'OK' or null
 */
async function set(key, value, ttl = 3600) {
  try {
    const result = await redis.setex(key, ttl, JSON.stringify(value));
    console.log('Cache set:', key, 'TTL:', ttl);
    return result;
  } catch (error) {
    console.error('Redis set error:', error);
    return null;
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<number>} - Number of keys deleted
 */
async function del(key) {
  try {
    const result = await redis.del(key);
    console.log('Cache deleted:', key);
    return result;
  } catch (error) {
    console.error('Redis delete error:', error);
    return null;
  }
}

/**
 * Clear all cache keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'nba:rankings:*')
 * @returns {Promise<number>} - Number of keys deleted
 */
async function deleteByPattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    const result = await redis.del(...keys);
    console.log(`Deleted ${result} keys matching pattern: ${pattern}`);
    return result;
  } catch (error) {
    console.error('Redis pattern delete error:', error);
    return null;
  }
}

/**
 * Check if Redis is connected and available
 * @returns {Promise<boolean>}
 */
async function isConnected() {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connection check failed:', error);
    return false;
  }
}

module.exports = {
  redis,
  get,
  set,
  del,
  deleteByPattern,
  isConnected,
};
