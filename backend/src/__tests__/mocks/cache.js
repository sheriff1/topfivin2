/**
 * Mock Redis Cache Client
 * Provides a Jest mock for cache operations used by services
 */

class MockCache {
  constructor() {
    this.store = new Map();
    this.getCount = 0;
    this.setCount = 0;
    this.delCount = 0;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    this.getCount++;
    const value = this.store.get(key);
    return value || null;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<string>} - 'OK'
   */
  async set(key, value, ttl = null) {
    this.setCount++;
    this.store.set(key, value);
    // In a real Redis implementation, ttl would expire the key
    // For testing, we just store it indefinitely unless reset
    return 'OK';
  }

  /**
   * Delete cache key
   * @param {string} key - Cache key
   * @returns {Promise<number>} - Number of keys deleted (0 or 1)
   */
  async del(key) {
    this.delCount++;
    if (this.store.has(key)) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async flushAll() {
    this.store.clear();
  }

  /**
   * Reset operation counts for assertions
   */
  resetCounts() {
    this.getCount = 0;
    this.setCount = 0;
    this.delCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      getCount: this.getCount,
      setCount: this.setCount,
      delCount: this.delCount,
      size: this.store.size,
    };
  }

  /**
   * Set raw cache data for testing
   * @param {object} data - Key-value pairs to set
   */
  setData(data) {
    Object.entries(data).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }
}

module.exports = MockCache;
