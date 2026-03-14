import { useApiHealth } from '../hooks/useApi';
import { Link, useLocation } from 'react-router-dom';

export function Layout({ children }) {
  const { data: health } = useApiHealth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-primary text-primary-content shadow-lg">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost normal-case text-2xl font-bold">
            🏀 NBA Stats Rankings
          </Link>
        </div>
        <div className="flex-none gap-2">
          {health && (
            <div className="tooltip" data-tip={`API Status: ${health.api || 'unknown'}`}>
              <span className="badge badge-success">
                {health.status || 'healthy'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="container mx-auto p-4 md:p-6">
        <div className="tabs tabs-bordered mb-6">
          <Link 
            to="/"
            className={`tab ${location.pathname === '/' ? 'tab-active' : ''}`}
          >
            Rankings
          </Link>
          <Link 
            to="/audit"
            className={`tab ${location.pathname === '/audit' ? 'tab-active' : ''}`}
          >
            Audit
          </Link>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
