import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // A free-tier host that has been idle can take 30-60s to wake up, so allow for that on the first request.
  timeout: 60000,
});

export { apiClient, API_BASE_URL };

// Current season (latest stored in the database), shared by all consumers via the query cache
export function useCurrentSeason() {
  return useQuery({
    queryKey: ["currentSeason"],
    queryFn: async () => {
      const response = await apiClient.get("/seasons");
      return response.data.current;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  });
}

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
export function useRankings(category, seasonOverride) {
  const { data: currentSeason } = useCurrentSeason();
  const season = seasonOverride ?? currentSeason;
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
    enabled: Boolean(category && season),
    placeholderData: keepPreviousData,
  });
}

// Hook for fetching team stats
export function useTeamStats(teamId, seasonOverride) {
  const { data: currentSeason } = useCurrentSeason();
  const season = seasonOverride ?? currentSeason;
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
    enabled: Boolean(teamId && season),
  });
}

// Hook for fetching team rankings
export function useTeamRankings(teamId, seasonOverride) {
  const { data: currentSeason } = useCurrentSeason();
  const season = seasonOverride ?? currentSeason;
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
    enabled: Boolean(teamId && season),
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
export function useRandomFacts(count = 10, seasonOverride) {
  const { data: currentSeason } = useCurrentSeason();
  const season = seasonOverride ?? currentSeason;
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
    enabled: Boolean(season),
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
