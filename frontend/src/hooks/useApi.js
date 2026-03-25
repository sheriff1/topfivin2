import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const CURRENT_SEASON = import.meta.env.VITE_CURRENT_SEASON || "2025";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export { apiClient, API_BASE_URL, CURRENT_SEASON };

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
export function useRankings(category, season = CURRENT_SEASON) {
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
    enabled: Boolean(category),
    placeholderData: keepPreviousData,
  });
}

// Hook for fetching team stats
export function useTeamStats(teamId, season = CURRENT_SEASON) {
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
    enabled: Boolean(teamId),
  });
}

// Hook for fetching team rankings
export function useTeamRankings(teamId, season = CURRENT_SEASON) {
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
    enabled: Boolean(teamId),
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
    enabled: Boolean(abbreviation),
  });
}

// Hook for fetching random top-5 facts
export function useRandomFacts(count = 10, season = CURRENT_SEASON) {
  return useQuery({
    queryKey: ["randomFacts", count, season],
    queryFn: async () => {
      const response = await apiClient.get("/rankings/random-facts", {
        params: { count, season },
      });
      return response.data.facts;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

// Hook for API health check
export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await axios.get("/health");
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
