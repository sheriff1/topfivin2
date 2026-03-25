import { useEffect } from "react";
import { AuditTab } from "../components/AuditTab";
import { CURRENT_SEASON } from "../hooks/useApi";

export function AuditPage() {
  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return <AuditTab season={CURRENT_SEASON} />;
}
