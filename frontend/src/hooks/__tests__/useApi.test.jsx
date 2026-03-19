import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as useApiModule from "../useApi";

// Import the actual module first to get real exports
const { apiClient, API_BASE_URL } = useApiModule;

describe("useApi Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test API_BASE_URL export
  describe("API_BASE_URL", () => {
    it("should export API_BASE_URL", () => {
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe("string");
    });

    it("should be /api by default", () => {
      expect(API_BASE_URL).toBe("/api");
    });
  });

  // Test apiClient setup
  describe("apiClient", () => {
    it("should be created as an axios instance", () => {
      expect(apiClient).toBeDefined();
    });

    it("should have baseURL set to API_BASE_URL", () => {
      expect(apiClient.defaults.baseURL).toBe(API_BASE_URL);
    });

    it("should have timeout set to 10000ms", () => {
      expect(apiClient.defaults.timeout).toBe(10000);
    });

    it("should have proper axios methods", () => {
      expect(typeof apiClient.get).toBe("function");
      expect(typeof apiClient.post).toBe("function");
      expect(typeof apiClient.put).toBe("function");
      expect(typeof apiClient.delete).toBe("function");
    });
  });

  // Test hook imports
  describe("Hook exports", () => {
    it("should export all hooks from the module", () => {
      expect(useApiModule.useCategories).toBeDefined();
      expect(useApiModule.useRankings).toBeDefined();
      expect(useApiModule.useTeamStats).toBeDefined();
      expect(useApiModule.useTeamRankings).toBeDefined();
      expect(useApiModule.useAllTeams).toBeDefined();
      expect(useApiModule.useTeamByAbbreviation).toBeDefined();
      expect(useApiModule.useApiHealth).toBeDefined();
    });

    it("should export hooks as functions", () => {
      expect(typeof useApiModule.useCategories).toBe("function");
      expect(typeof useApiModule.useRankings).toBe("function");
      expect(typeof useApiModule.useTeamStats).toBe("function");
      expect(typeof useApiModule.useTeamRankings).toBe("function");
      expect(typeof useApiModule.useAllTeams).toBe("function");
      expect(typeof useApiModule.useTeamByAbbreviation).toBe("function");
      expect(typeof useApiModule.useApiHealth).toBe("function");
    });
  });

  // Test apiClient methods
  describe("apiClient methods", () => {
    it("should have all axios methods", () => {
      expect(typeof apiClient.get).toBe("function");
      expect(typeof apiClient.post).toBe("function");
      expect(typeof apiClient.put).toBe("function");
      expect(typeof apiClient.patch).toBe("function");
      expect(typeof apiClient.delete).toBe("function");
      expect(typeof apiClient.head).toBe("function");
    });

    it("should be configured as an axios instance", () => {
      expect(apiClient.defaults).toBeDefined();
      expect(apiClient.interceptors).toBeDefined();
    });

    it("should have proper configuration applied", () => {
      // Verify the configuration we expect
      expect(apiClient.defaults.baseURL).toBe("/api");
      expect(apiClient.defaults.timeout).toBe(10000);
    });
  });

  // Test timeout configuration
  describe("Timeout configuration", () => {
    it("should have 10 second timeout for API calls", () => {
      expect(apiClient.defaults.timeout).toBe(10000);
    });

    it("should preserve timeout across multiple accesses", () => {
      const timeout1 = apiClient.defaults.timeout;
      const timeout2 = apiClient.defaults.timeout;
      expect(timeout1).toBe(timeout2);
      expect(timeout1).toBe(10000);
    });
  });

  // Test API endpoint consistency
  describe("API endpoints", () => {
    it("should have the correct base URL for all requests", () => {
      expect(apiClient.defaults.baseURL).toBe("/api");
    });

    it("should be properly configured for team endpoints", () => {
      // Verify that the client is configured to support team endpoints
      expect(apiClient.get).toBeDefined();
    });

    it("should use the correct timeout for all requests", () => {
      expect(apiClient.defaults.timeout).toBe(10000);
    });
  });

  // Test parameter handling
  describe("Parameter handling", () => {
    it("should have a functional get method", () => {
      expect(typeof apiClient.get).toBe("function");
    });

    it("should have post, put, delete methods available", () => {
      expect(typeof apiClient.post).toBe("function");
      expect(typeof apiClient.put).toBe("function");
      expect(typeof apiClient.delete).toBe("function");
    });
  });

  // Test configuration stability
  describe("Configuration stability", () => {
    it("should maintain configuration after module load", () => {
      expect(apiClient.defaults.baseURL).toBe("/api");
      expect(apiClient.defaults.timeout).toBe(10000);
    });

    it("should have consistent configuration across test runs", () => {
      const baseURL1 = apiClient.defaults.baseURL;
      const timeout1 = apiClient.defaults.timeout;
      
      const baseURL2 = apiClient.defaults.baseURL;
      const timeout2 = apiClient.defaults.timeout;

      expect(baseURL1).toBe(baseURL2);
      expect(timeout1).toBe(timeout2);
    });

    it("should support all standard HTTP methods", () => {
      const httpMethods = ["get", "post", "put", "patch", "delete", "head"];
      httpMethods.forEach(method => {
        expect(typeof apiClient[method]).toBe("function");
      });
    });
  });
});
