import Link from "next/link";
import { PageHead } from "@/components/Portal";
import { rows } from "@/lib/clearpath";

const definitions = [
  ["new-order-review", "New Order Review", "Validate package, authorization, and screening setup.", "▤", "blue"],
  ["candidate-missing-information", "Candidate Missing Information", "Send candidate requests and schedule follow-up.", "♙", "amber"],
  ["unassigned-searches", "Unassigned Searches", "Assign an approved vendor, cost, and due date.", "⌕", "blue"],
  ["verification-follow-up", "Verification Follow-Up", "Log phone, email, and candidate-assistance attempts.", "✉", "purple"],
  ["overdue-searches", "Overdue Searches", "Contact vendors and record a dated escalation.", "!", "red"],
  ["record-review", "Record Review", "Document structured criminal-record match decisions.", "◇", "red"],
  ["reports-ready-for-qa", "Reports Ready for QA", "Select the exact QA record and complete its checklist.", "✓", "purple"],
  ["reports-ready-to-release", "Reports Ready to Release", "Review approved QA records and release reports.", "▣", "green"],
  ["billing-exceptions", "Billing Exceptions", "Resolve corrected fees or request client approval.", "$", "amber"],
] as const;

function count(sql: string) {
  return Number(rows(sql)[0]?.count || 0);
}

export default function QueuesPage() {
  const counts: Record<string, number> = {
    "new-order-review": count("SELECT COUNT(*) count FROM cp_orders WHERE id<=18"),
    "candidate-missing-information": count("SELECT COUNT(*) count FROM cp_orders WHERE status='Candidate Action Required'"),
    "unassigned-searches": count("SELECT COUNT(*) count FROM cp_searches WHERE vendor='Unassigned'"),
    "verification-follow-up": count("SELECT COUNT(*) count FROM cp_searches WHERE type IN ('Employment Verification','Education Verification') AND status NOT IN ('Completed','Cancelled')"),
    "overdue-searches": count("SELECT COUNT(*) count FROM cp_searches WHERE due_date<'2026-07-12' AND status NOT IN ('Completed','Cancelled')"),
    "record-review": count("SELECT COUNT(*) count FROM cp_searches WHERE status='Possible Record' AND type IN ('County Criminal Search','National Criminal Database')"),
    "reports-ready-for-qa": count("SELECT COUNT(*) count FROM cp_qa WHERE status IN ('Pending Review','Additional Research','Compliance Review')"),
    "reports-ready-to-release": count("SELECT COUNT(*) count FROM cp_qa WHERE status='Approved'"),
    "billing-exceptions": count("SELECT COUNT(*) count FROM cp_billing WHERE status NOT IN ('Resolved','Invoiced')"),
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const urgent = counts["overdue-searches"] + counts["record-review"];

  return (
    <div className="page queues-workspace">
      <PageHead
        eyebrow="WORK MANAGEMENT"
        title="Priority Queues"
        subtitle="Focused operational work with explicit, auditable next actions."
      />
      <section className="queue-overview" aria-label="Queue summary">
        <article><span>Open queue entries</span><strong>{total}</strong><small>Across nine workflows; an item can appear in more than one</small></article>
        <article className="red"><span>Urgent review</span><strong>{urgent}</strong><small>Overdue or possible-record items</small></article>
        <article className="blue"><span>Assigned workflows</span><strong>{counts["verification-follow-up"]}</strong><small>Verification attempts requiring action</small></article>
        <article className="purple"><span>Quality review</span><strong>{counts["reports-ready-for-qa"]}</strong><small>Reports awaiting checklist decisions</small></article>
      </section>
      <div className="priority-queue-grid">
        {definitions.map(([slug, title, description, icon, tone]) => (
          <Link className={`priority-queue-card ${tone}`} href={`/app/queues/${slug}`} key={slug}>
            <div className="priority-queue-card-head">
              <span aria-hidden="true">{icon}</span>
              <b>{counts[slug]}</b>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <div><span>{counts[slug] === 1 ? "1 open item" : `${counts[slug]} open items`}</span><strong>Open queue →</strong></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
