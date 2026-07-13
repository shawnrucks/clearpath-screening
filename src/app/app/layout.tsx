import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {INTERNAL_ROLES, SESSION_COOKIE, hasRole, verifySessionToken} from "@/lib/auth";
import {Portal} from "@/components/Portal";
import {rows} from "@/lib/clearpath";
import {DEMO_RESET_ROLES, isDemoResetEnabled} from "@/lib/demo";

export default async function AppLayout({children}: {children: React.ReactNode}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!hasRole(session, INTERNAL_ROLES)) redirect("/login");
  const counts=rows(`SELECT
    (SELECT COUNT(*) FROM cp_orders WHERE status='Candidate Action Required') candidate,
    (SELECT COUNT(*) FROM cp_searches WHERE vendor='Unassigned') unassigned,
    (SELECT COUNT(*) FROM cp_searches WHERE due_date<'2026-07-12' AND status NOT IN ('Completed','Cancelled')) overdue,
    (SELECT COUNT(*) FROM cp_qa WHERE status IN ('Pending Review','Additional Research','Compliance Review')) qa,
    (SELECT COUNT(*) FROM cp_billing WHERE status NOT IN ('Resolved','Invoiced')) billing`)[0] || {};
  const notificationCounts={overdue:Number(counts.overdue||0),qa:Number(counts.qa||0),billing:Number(counts.billing||0)};
  const queueCount=Number(counts.candidate||0)+Number(counts.unassigned||0)+notificationCounts.overdue+notificationCounts.qa+notificationCounts.billing;
  const canResetDemoData = isDemoResetEnabled() && hasRole(session, DEMO_RESET_ROLES);
  return <Portal user={{name: session!.name, role: session!.role}} queueCount={queueCount} notificationCounts={notificationCounts} canResetDemoData={canResetDemoData}>{children}</Portal>;
}
