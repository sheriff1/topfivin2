import { useEffect } from "react";
import { AuditTab } from "../components/AuditTab";
import { useCurrentSeason } from "../hooks/useApi";
import { usePageTitle } from "../hooks/usePageTitle";

export function AuditPage() {
  usePageTitle("Audit");
  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: season } = useCurrentSeason();
  return <AuditTab season={season} />;
}
