import {PageHead} from "@/components/Portal";
import {rows} from "@/lib/clearpath";
import AuditExplorer from "./AuditExplorer";

export default function AuditLog(){
  const events=rows("SELECT * FROM cp_audit ORDER BY id DESC LIMIT 500");
  return <div className="page"><PageHead eyebrow="COMPLIANCE EVIDENCE" title="Audit Log" subtitle="Immutable history of meaningful operational actions and their recorded evidence."/><AuditExplorer initialRows={events}/></div>;
}
