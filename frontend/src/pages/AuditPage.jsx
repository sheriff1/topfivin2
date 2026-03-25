import { AuditTab } from "../components/AuditTab";
import { CURRENT_SEASON } from "../hooks/useApi";

export function AuditPage() {
  return <AuditTab season={CURRENT_SEASON} />;
}
