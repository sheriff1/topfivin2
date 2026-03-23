import { useState } from "react";
import { AuditTab } from "../components/AuditTab";
import { GameCountTab } from "../components/GameCountTab";
import { RankingsGrid } from "../components/RankingsGrid";
import { useCategories, useApiHealth } from "../hooks/useApi";

export function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState("PPG");
  const season = "2025"; // Only 2025-26 season available
  const [activeTab, setActiveTab] = useState("rankings");
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: health } = useApiHealth();

  // Get the label for the selected category
  const selectedCategoryLabel =
    categories?.find((cat) => cat.code === selectedCategory)?.label || selectedCategory;

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-primary text-primary-content shadow-lg">
        <div className="flex-1">
          <div className="btn btn-ghost normal-case text-2xl font-bold">🏀 NBA Stats Rankings</div>
        </div>
        <div className="flex-none gap-2">
          {health && (
            <div className="tooltip" data-tip={`API Status: ${health.api || "unknown"}`}>
              <span className="badge badge-success">{health.status || "healthy"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 md:p-6">
        {/* Tab Navigation */}
        <div className="tabs tabs-bordered mb-6">
          <a
            className={`tab ${activeTab === "rankings" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("rankings")}
          >
            Rankings
          </a>
          <a
            className={`tab ${activeTab === "games-count" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("games-count")}
          >
            Games Count
          </a>
          <a
            className={`tab ${activeTab === "audit" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            Audit
          </a>
        </div>

        {/* Rankings Tab */}
        {activeTab === "rankings" && (
          <>
            {/* Controls Section */}
            <div className="card bg-base-200 shadow-xl mb-6">
              <div className="card-body">
                <h2 className="card-title text-xl">Filters</h2>

                <div className="grid grid-cols-1 gap-4">
                  {/* Category Selector */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">Stat Category</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      disabled={categoriesLoading}
                    >
                      {categoriesLoading ? (
                        <option>Loading categories...</option>
                      ) : (
                        categories?.map((cat) => (
                          <option key={cat.code} value={cat.code}>
                            {cat.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Rankings Display */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl mb-4">
                  {selectedCategoryLabel} Rankings - 2025-26 Season
                </h2>
                <RankingsGrid category={selectedCategory} season={season} />
              </div>
            </div>
          </>
        )}

        {/* Games Count Tab */}
        {activeTab === "games-count" && <GameCountTab season={season} />}

        {/* Audit Tab */}
        {activeTab === "audit" && <AuditTab season={season} />}
      </div>
    </div>
  );
}
