import axios from "axios";
import { useQuery } from "@tanstack/react-query";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export { apiClient, API_BASE_URL };

// Hook for fetching available categories
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiClient.get("/categories");
      return response.data.categories;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
  });
}

// Hook for fetching rankings for a specific category
export function useRankings(category, season = "2025") {
  return useQuery({
    queryKey: ["rankings", category, season],
    queryFn: async () => {
      const response = await apiClient.get("/rankings", {
        params: { category, season },
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    enabled: !!category,
  });
}

// Hook for fetching team stats
export function useTeamStats(teamId, season = "2025") {
  return useQuery({
    queryKey: ["teamStats", teamId, season],
    queryFn: async () => {
      const response = await apiClient.get(`/team/${teamId}/stats`, {
        params: { season },
      });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    enabled: !!teamId,
  });
}

// Hook for fetching team rankings
export function useTeamRankings(teamId, season = "2025") {
  return useQuery({
    queryKey: ["teamRankings", teamId, season],
    queryFn: async () => {
      const response = await apiClient.get(`/team/${teamId}/rankings`, {
        params: { season },
      });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    enabled: !!teamId,
  });
}

// Hook for fetching all teams
export function useAllTeams() {
  return useQuery({
    queryKey: ["allTeams"],
    queryFn: async () => {
      const response = await apiClient.get("/teams");
      return response.data.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
  });
}

// Hook for fetching team by abbreviation
export function useTeamByAbbreviation(abbreviation) {
  return useQuery({
    queryKey: ["teamByAbbr", abbreviation],
    queryFn: async () => {
      const response = await apiClient.get(`/teams/abbr/${abbreviation}`);
      return response.data.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
    enabled: !!abbreviation,
  });
}

// Hook for API health check
export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const healthUrl = `${API_BASE_URL.replace(/\/api$/, "")}/health`;
      const response = await apiClient.get(healthUrl);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
