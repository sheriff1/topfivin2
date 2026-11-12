import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axios from "axios";
import { useSyncExternalStore } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // A free-tier host that has been idle can take 30-60s to wake up, so allow for that on the first request.
  timeout: 60000,
});

export { apiClient, API_BASE_URL };

// Season the user picked in the UI (null = follow the latest stored season). Kept outside React so every
// hook sees the same value without a provider, and remembered across visits.
const SELECTED_SEASON_KEY = "selectedSeason";
let selectedSeason = null;
try {
  selectedSeason = window.localStorage.getItem(SELECTED_SEASON_KEY);
} catch {
  // storage unavailable (private mode, blocked): selection just lasts for this page view
}
const seasonListeners = new Set();

function subscribeToSelectedSeason(listener) {
  seasonListeners.add(listener);
  return () => seasonListeners.delete(listener);
}

function getSelectedSeason() {
  return selectedSeason;
}

function setSelectedSeason(season) {
  selectedSeason = season;
  try {
    if (season) window.localStorage.setItem(SELECTED_SEASON_KEY, season);
    else window.localStorage.removeItem(SELECTED_SEASON_KEY);
  } catch {
    // ignore storage errors
  }
  seasonListeners.forEach((listener) => listener());
}

// Seasons stored in the database: { current (latest), available (newest first) }
export function useSeasons() {
  return useQuery({
    queryKey: ["seasons"],
    queryFn: async () => {
      const response = await apiClient.get("/seasons");
      return { current: response.data.current, available: response.data.available ?? [] };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  });
}

// Season the whole UI shows: the user's pick if it is still stored, otherwise the latest stored season.
// Shared by all consumers via the query cache; `data` is the season string.
export function useCurrentSeason() {
  const query = useSeasons();
  const picked = useSyncExternalStore(subscribeToSelectedSeason, getSelectedSeason);
  const seasons = query.data;
  const data =
    seasons && picked && seasons.available.includes(picked) ? picked : (seasons?.current ?? null);
  return { ...query, data };
}

// Season picker state: the shown season, the latest one, all stored ones and a setter.
export function useSeasonSelection() {
  const { data: season } = useCurrentSeason();
  const { data: seasons } = useSeasons();
  const current = seasons?.current ?? null;
  return {
    season,
    current,
    available: seasons?.available ?? [],
    // Picking the latest season clears the pick so the site keeps following new seasons
    setSeason: (next) => setSelectedSeason(next === current ? null : next),
  };
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
  const { data: season } = useCurrentSeason();
  return useQuery({
    queryKey: ["allTeams", season],
    queryFn: async () => {
      // season scopes trophy_count
      const response = await apiClient.get("/teams", { params: { season } });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
    enabled: Boolean(season),
    placeholderData: keepPreviousData,
  });
}

// Hook for fetching team by abbreviation
export function useTeamByAbbreviation(abbreviation) {
  const { data: season } = useCurrentSeason();
  return useQuery({
    queryKey: ["teamByAbbr", abbreviation, season],
    queryFn: async () => {
      const response = await apiClient.get(`/teams/abbr/${abbreviation}`, { params: { season } });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
    enabled: Boolean(abbreviation && season),
    placeholderData: keepPreviousData,
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
