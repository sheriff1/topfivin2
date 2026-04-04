/* global localStorage */
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const IS_DEV = !import.meta.env.PROD;

function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function Layout({ children }) {
  const location = useLocation();
  const { pathname } = location;
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navLinks = (
    <>
      <Link
        to="/"
        className={`btn btn-ghost btn-sm ${pathname === "/" ? "bg-primary-content/20" : ""}`}
      >
        Rankings
      </Link>
      <Link
        to="/game"
        className={`btn btn-ghost btn-sm ${pathname === "/game" ? "bg-primary-content/20" : ""}`}
      >
        Game
      </Link>
      <Link
        to="/teams"
        className={`btn btn-ghost btn-sm ${
          pathname === "/teams" || pathname.startsWith("/team/") ? "bg-primary-content/20" : ""
        }`}
      >
        Teams
      </Link>
      {IS_DEV && (
        <Link
          to="/games-count"
          className={`btn btn-ghost btn-sm ${pathname === "/games-count" ? "bg-primary-content/20" : ""}`}
        >
          Games Count
        </Link>
      )}
      {IS_DEV && (
        <Link
          to="/audit"
          className={`btn btn-ghost btn-sm ${pathname === "/audit" ? "bg-primary-content/20" : ""}`}
        >
          Audit
        </Link>
      )}
      <Link
        to="/about"
        className={`btn btn-ghost btn-sm ${pathname === "/about" ? "bg-primary-content/20" : ""}`}
      >
        About
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      {/* Navbar */}
      <div className="navbar min-h-10 bg-neutral text-neutral-content shadow-lg px-4 sticky top-0 z-50">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost btn-sm normal-case text-lg font-bold gap-1 px-2">
            🏀 NBA Top Five In
          </Link>
        </div>
        <div className="navbar-end">
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1 items-center">
            {navLinks}
            <label className="toggle text-base-content">
              <input
                type="checkbox"
                value="dark"
                className="theme-controller"
                checked={theme === "dark"}
                onChange={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              />
              <svg aria-label="sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </g>
              </svg>
              <svg aria-label="moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </g>
              </svg>
            </label>
          </nav>
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="btn btn-ghost btn-sm md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Full-screen mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-neutral text-neutral-content flex flex-col">
          {/* Close button */}
          <div className="flex justify-end p-4">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {/* Menu links */}
          <nav className="flex flex-col items-center justify-center flex-1 gap-6 text-xl">
            <Link
              to="/"
              className={`btn btn-ghost btn-lg text-xl ${pathname === "/" ? "bg-primary-content/20" : ""}`}
            >
              Rankings
            </Link>
            <Link
              to="/game"
              className={`btn btn-ghost btn-lg text-xl ${pathname === "/game" ? "bg-primary-content/20" : ""}`}
            >
              Game
            </Link>
            <Link
              to="/teams"
              className={`btn btn-ghost btn-lg text-xl ${
                pathname === "/teams" || pathname.startsWith("/team/")
                  ? "bg-primary-content/20"
                  : ""
              }`}
            >
              Teams
            </Link>
            {IS_DEV && (
              <Link
                to="/games-count"
                className={`btn btn-ghost btn-lg text-xl ${pathname === "/games-count" ? "bg-primary-content/20" : ""}`}
              >
                Games Count
              </Link>
            )}
            {IS_DEV && (
              <Link
                to="/audit"
                className={`btn btn-ghost btn-lg text-xl ${pathname === "/audit" ? "bg-primary-content/20" : ""}`}
              >
                Audit
              </Link>
            )}
            <Link
              to="/about"
              className={`btn btn-ghost btn-lg text-xl ${pathname === "/about" ? "bg-primary-content/20" : ""}`}
            >
              About
            </Link>
            <label className="toggle text-base-content scale-150">
              <input
                type="checkbox"
                value="dark"
                className="theme-controller"
                checked={theme === "dark"}
                onChange={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              />
              <svg aria-label="sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </g>
              </svg>
              <svg aria-label="moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </g>
              </svg>
            </label>
          </nav>
        </div>
      )}

      {/* Page Content */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="bg-base-200 text-base-content p-4">
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
          <p className="text-sm">
            Made with ❤️ for 🏀 by{" "}
            <a
              href="https://webflow.sheriffjolaoso.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-accent"
            >
              Sheriff
            </a>
          </p>
          <a
            href="https://www.instagram.com/nbatopfivein/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-base-content hover:text-pink-500 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
