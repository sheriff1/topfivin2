import { Link, useLocation } from "react-router-dom";

const IS_DEV = !import.meta.env.PROD;

export function Layout({ children }) {
  const location = useLocation();
  const { pathname } = location;

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Header */}
      <div className="navbar bg-primary text-primary-content shadow-lg">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost normal-case text-2xl font-bold">
            🏀 NBA Top Five In
          </Link>
        </div>
        <div className="flex-none gap-2"></div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-base-200 border-b border-base-300">
        <div className="container mx-auto px-4">
          <div className="tabs tabs-bordered overflow-x-auto flex-nowrap">
            <Link
              to="/"
              className={`tab whitespace-nowrap ${pathname === "/" ? "tab-active" : ""}`}
            >
              Rankings
            </Link>
            <Link
              to="/teams"
              className={`tab whitespace-nowrap ${
                pathname === "/teams" || pathname.startsWith("/team/") ? "tab-active" : ""
              }`}
            >
              Teams
            </Link>
            {IS_DEV && (
              <Link
                to="/games-count"
                className={`tab whitespace-nowrap ${pathname === "/games-count" ? "tab-active" : ""}`}
              >
                Games Count
              </Link>
            )}
            {IS_DEV && (
              <Link
                to="/audit"
                className={`tab whitespace-nowrap ${pathname === "/audit" ? "tab-active" : ""}`}
              >
                Audit
              </Link>
            )}
            <Link
              to="/about"
              className={`tab whitespace-nowrap ${pathname === "/about" ? "tab-active" : ""}`}
            >
              About
            </Link>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="bg-base-200 text-base-content text-center p-4">
        <p>
          Made with ❤️ for 🏀 by{" "}
          <a
            href="https://webflow.sheriffjolaoso.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary"
          >
            Sheriff
          </a>
        </p>
      </footer>
    </div>
  );
}
