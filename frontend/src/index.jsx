import * as Sentry from "@sentry/react";
import { inject } from "@vercel/analytics";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Initialize Vercel Analytics
inject();

// Browser error monitoring (#194). Disabled unless VITE_SENTRY_DSN is set (never in dev/tests).
// Errors only: no tracing or session replay, no default PII.
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<p role="alert">Something went wrong. Please refresh the page.</p>}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
