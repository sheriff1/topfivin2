import { AuditTab } from "../components/AuditTab";

export function AuditPage() {
  const season = "2025"; // Only 2025-26 season available

  return <AuditTab season={season} />;
}
