import { useState, useRef } from 'react';
import { useCategories, useRankings } from '../hooks/useApi';
import { RankingsGrid } from '../components/RankingsGrid';
import { Top5Showcase } from '../components/Top5Showcase';

export function RankingsPage() {
  const [selectedCategory, setSelectedCategory] = useState('PPG');
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const season = process.env.REACT_APP_CURRENT_SEASON || '2025';
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: rankings } = useRankings(selectedCategory, season);
  
  // Track last category change time for debounce logic
  const lastCategoryChangeRef = useRef(Date.now());
  
  // Handle category change with debounce logic
  const handleCategoryChange = (newCategory) => {
    const now = Date.now();
    const timeDelta = now - lastCategoryChangeRef.current;
    
    // Skip animation if category changed within 200ms (rapid clicks)
    setShouldAnimate(timeDelta >= 200);
    
    lastCategoryChangeRef.current = now;
    setSelectedCategory(newCategory);
  };

  return (
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
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={categoriesLoading}
              >
                {categoriesLoading ? (
                  <option>Loading categories...</option>
                ) : (
                  categories?.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label} ({cat.code})
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
            {selectedCategory} Rankings - 2025-26 Season
          </h2>
          
          {/* Top 5 Showcase - above the rankings table */}
          <Top5Showcase 
            rankings={rankings}
            category={selectedCategory}
            shouldAnimate={shouldAnimate}
          />
          
          {/* Rankings Table */}
          <RankingsGrid 
            category={selectedCategory} 
            season={season}
          />
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Popular Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories?.slice(0, 4).map((stat) => (
            <button
              key={stat.code}
              onClick={() => setSelectedCategory(stat.code)}
              className={`btn btn-outline ${selectedCategory === stat.code ? 'btn-active' : ''}`}
            >
              {stat.code}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
