import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rows } from "@/lib/clearpath";
import QualityReviewWorkspace from "./QualityReviewWorkspace";

export default async function QualityReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ qa?: string | string[] }>;
}) {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const requested = (await searchParams).qa;
  const selectedQa = Array.isArray(requested) ? requested[0] : requested;
  const reviews = rows(`
    SELECT q.*, o.order_id, o.position, o.status order_status, o.target_date,
      c.name candidate, c.email candidate_email, cl.name client, o.package,
      (SELECT COUNT(*) FROM cp_qa_checklist_items i WHERE i.qa_id=q.id) checklist_total,
      (SELECT COUNT(*) FROM cp_qa_checklist_items i WHERE i.qa_id=q.id AND i.completed=1) checklist_complete
    FROM cp_qa q
    JOIN cp_orders o ON o.id=q.order_id
    JOIN cp_candidates c ON c.id=o.candidate_id
    JOIN cp_clients cl ON cl.id=o.client_id
    ORDER BY CASE q.status WHEN 'Pending Review' THEN 0 WHEN 'Additional Research' THEN 1 WHEN 'Compliance Review' THEN 2 WHEN 'Approved' THEN 3 WHEN 'Released' THEN 4 ELSE 5 END,
      CASE q.priority WHEN 'High' THEN 0 ELSE 1 END,q.age DESC,q.id
  `);
  return (
    <QualityReviewWorkspace
      initialReviews={reviews}
      requestedQa={selectedQa || ""}
      role={session?.role || ""}
    />
  );
}
