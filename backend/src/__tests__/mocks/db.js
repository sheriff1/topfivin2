/**
 * Mock PostgreSQL Database Client
 * Provides a Jest mock for database operations used by services
 * Can be configured with mock return data
 */

class MockDatabase {
  constructor() {
    this.data = {};
    this.queryCount = 0;
    this.lastQuery = null;
    this.lastParams = null;
  }

  /**
   * Mock query method
   * @param {string} query - SQL query string
   * @param {array} params - Query parameters
   * @returns {object} - { rows: [], rowCount: 0 }
   */
  async query(query, params = []) {
    this.queryCount++;
    this.lastQuery = query;
    this.lastParams = params;

    // Return configured mock data if available
    const queryKey = this._normalizeQuery(query);
    if (this.data[queryKey]) {
      return this.data[queryKey];
    }

    // Default: return empty result set
    return { rows: [], rowCount: 0 };
  }

  /**
   * Set mock return data for a specific query
   * @param {string} query - SQL query pattern to match
   * @param {object} mockData - { rows: [], rowCount: number }
   */
  setMockData(query, mockData) {
    const queryKey = this._normalizeQuery(query);
    this.data[queryKey] = mockData;
  }

  /**
   * Normalize query for matching (remove extra whitespace)
   * @param {string} query - Query string
   * @returns {string} - Normalized query
   */
  _normalizeQuery(query) {
    return query
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  /**
   * Reset mock data and query history
   */
  reset() {
    this.data = {};
    this.queryCount = 0;
    this.lastQuery = null;
    this.lastParams = null;
  }

  /**
   * Get query history for assertions
   */
  getQueryHistory() {
    return {
      count: this.queryCount,
      lastQuery: this.lastQuery,
      lastParams: this.lastParams,
    };
  }
}

module.exports = MockDatabase;
