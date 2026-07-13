import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rows } from "@/lib/clearpath";
import OperationsReportForm from "./OperationsReportForm";

type CountRow = { count: number };

function count(sql: string) {
  return Number((rows(sql)[0] as CountRow | undefined)?.count || 0);
}

export default async function OperationsReportPage() {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const metrics = [
    { label: "New Orders", value: count("SELECT COUNT(*) count FROM cp_orders WHERE order_date='2026-07-12'") },
    { label: "Completed Reports", value: count("SELECT COUNT(*) count FROM cp_orders WHERE status='Complete'") },
    { label: "Backlog", value: count("SELECT COUNT(*) count FROM cp_orders WHERE status NOT IN ('Complete','Cancelled')") },
    { label: "Overdue Items", value: count("SELECT COUNT(*) count FROM cp_searches WHERE due_date<'2026-07-12' AND status NOT IN ('Completed','Cancelled')") },
    { label: "Candidate Pending", value: count("SELECT COUNT(*) count FROM cp_orders WHERE status='Candidate Action Required'") },
    { label: "Client Action Required", value: count("SELECT COUNT(*) count FROM cp_orders WHERE status='Client Action Required'") },
    { label: "QA Queue", value: count("SELECT COUNT(*) count FROM cp_qa WHERE status IN ('Pending Review','Additional Research','Compliance Review')") },
    { label: "Billing Exceptions", value: count("SELECT COUNT(*) count FROM cp_billing WHERE status NOT IN ('Resolved','Invoiced')") },
    { label: "High-Priority Issues", value: count("SELECT COUNT(*) count FROM cp_orders WHERE priority IN ('Urgent','High') AND status NOT IN ('Complete','Cancelled')") },
  ];

  return <OperationsReportForm metrics={metrics} preparedBy={session?.name || "Current signed-in user"} />;
}
