import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rows } from "@/lib/clearpath";
import QueueWorkspace, { type QueueSlug } from "./QueueWorkspace";

const queueMeta: Record<QueueSlug, { title: string; description: string; guidance: string }> = {
  "new-order-review": {
    title: "New Order Review",
    description: "Validate package, authorization, and screening setup before work begins.",
    guidance: "Open the order to review its candidate, package, searches, and supporting documents.",
  },
  "candidate-missing-information": {
    title: "Candidate Missing Information",
    description: "Send a stored candidate request and schedule the next follow-up.",
    guidance: "Each request creates an in-system communication and a dated follow-up trail.",
  },
  "unassigned-searches": {
    title: "Unassigned Searches",
    description: "Assign an approved vendor with a confirmed cost and due date.",
    guidance: "Vendor, cost, due date, and assignment note are saved directly to the search.",
  },
  "verification-follow-up": {
    title: "Verification Follow-Up",
    description: "Log phone, email, or candidate-assistance attempts with an outcome.",
    guidance: "Non-terminal outcomes require a next follow-up; every attempt remains in history.",
  },
  "overdue-searches": {
    title: "Overdue Searches",
    description: "Contact the assigned vendor and record a dated escalation.",
    guidance: "Messages are delivered inside ClearPath and linked to the exact vendor and search.",
  },
  "record-review": {
    title: "Criminal Record Review",
    description: "Compare identifiers and persist a documented human decision.",
    guidance: "Ambiguous identity or reportability decisions should be routed to Compliance Review.",
  },
  "reports-ready-for-qa": {
    title: "Reports Ready for QA",
    description: "Select the exact QA record and complete its checklist.",
    guidance: "Open a QA record to save checklist evidence and submit a role-authorized decision.",
  },
  "reports-ready-to-release": {
    title: "Reports Ready to Release",
    description: "Review approved QA records and explicitly release the report.",
    guidance: "Release is a recorded QA decision and never occurs from a generic status control.",
  },
  "billing-exceptions": {
    title: "Billing Exceptions",
    description: "Resolve a corrected vendor fee or request documented client approval.",
    guidance: "Choose the correct typed workflow so the financial decision is preserved in audit history.",
  },
};

const slugs = new Set(Object.keys(queueMeta));

const orderSelect = `
  SELECT o.id, o.order_id record_id, o.order_id, NULL search_id, NULL qa_id,
    NULL billing_id, NULL vendor_id, c.name candidate, c.email candidate_email,
    c.dob candidate_dob, c.address candidate_address, c.aliases candidate_aliases,
    cl.name client, o.position, o.package, o.issue, o.status, o.aging,
    o.assigned_to, o.priority, o.target_date due_date, NULL type,
    NULL jurisdiction, NULL vendor, NULL vendor_cost, NULL expected_cost,
    NULL client_price, NULL result, NULL notes, NULL issue_count, NULL reviewer
  FROM cp_orders o
  JOIN cp_candidates c ON c.id=o.candidate_id
  JOIN cp_clients cl ON cl.id=o.client_id`;

const searchSelect = `
  SELECT s.id, s.search_id record_id, o.order_id, s.search_id, NULL qa_id,
    NULL billing_id, v.id vendor_id, c.name candidate, c.email candidate_email,
    c.dob candidate_dob, c.address candidate_address, c.aliases candidate_aliases,
    cl.name client, o.position, o.package,
    CASE WHEN s.status='Possible Record' THEN s.result
      ELSE COALESCE(NULLIF(s.delay_reason,''), NULLIF(o.issue,''), s.result) END issue,
    s.status, CAST(julianday('2026-07-12')-julianday(COALESCE(s.date_assigned,o.order_date)) AS INTEGER) aging,
    CASE WHEN s.vendor='Unassigned' THEN 'Unassigned' ELSE s.vendor END assigned_to,
    CASE WHEN s.due_date<'2026-07-12' THEN 'Urgent' WHEN o.priority IN ('Urgent','High') THEN o.priority ELSE 'Normal' END priority,
    s.due_date, s.type, s.jurisdiction, s.vendor, v.contact vendor_contact, s.vendor_cost, s.expected_cost,
    s.client_price, s.result, s.notes, NULL issue_count, NULL reviewer
  FROM cp_searches s
  JOIN cp_orders o ON o.id=s.order_id
  JOIN cp_candidates c ON c.id=o.candidate_id
  JOIN cp_clients cl ON cl.id=o.client_id
  LEFT JOIN cp_vendors v ON lower(v.name)=lower(s.vendor)`;

function queueRows(slug: QueueSlug) {
  switch (slug) {
    case "new-order-review":
      return rows(`${orderSelect} WHERE o.id<=18 ORDER BY CASE o.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,o.id DESC`);
    case "candidate-missing-information":
      return rows(`${orderSelect} WHERE o.status='Candidate Action Required' ORDER BY CASE o.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,o.aging DESC`);
    case "unassigned-searches":
      return rows(`${searchSelect} WHERE s.vendor='Unassigned' ORDER BY s.due_date,s.id`);
    case "verification-follow-up":
      return rows(`${searchSelect} WHERE s.type IN ('Employment Verification','Education Verification') AND s.status NOT IN ('Completed','Cancelled') ORDER BY s.due_date,s.id`);
    case "overdue-searches":
      return rows(`${searchSelect} WHERE s.due_date<'2026-07-12' AND s.status NOT IN ('Completed','Cancelled') ORDER BY s.due_date,s.id`);
    case "record-review":
      return rows(`${searchSelect} WHERE s.status='Possible Record' AND s.type IN ('County Criminal Search','National Criminal Database') ORDER BY s.id`);
    case "reports-ready-for-qa":
      return rows(`
        SELECT q.id, q.qa_id record_id, o.order_id, NULL search_id, q.qa_id,
          NULL billing_id, NULL vendor_id, c.name candidate, c.email candidate_email,
          c.dob candidate_dob, c.address candidate_address, c.aliases candidate_aliases,
          cl.name client, o.position, o.package, o.issue, q.status, q.age aging,
          q.reviewer assigned_to, q.priority, o.target_date due_date, 'Quality review' type,
          NULL jurisdiction, NULL vendor, NULL vendor_cost, NULL expected_cost,
          NULL client_price, NULL result, q.decision_note notes, q.issue_count, q.reviewer
        FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id
        JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id
        WHERE q.status IN ('Pending Review','Additional Research','Compliance Review')
        ORDER BY CASE q.priority WHEN 'High' THEN 0 ELSE 1 END,q.age DESC,q.id`);
    case "reports-ready-to-release":
      return rows(`
        SELECT q.id, q.qa_id record_id, o.order_id, NULL search_id, q.qa_id,
          NULL billing_id, NULL vendor_id, c.name candidate, c.email candidate_email,
          c.dob candidate_dob, c.address candidate_address, c.aliases candidate_aliases,
          cl.name client, o.position, o.package, o.issue, q.status, q.age aging,
          q.reviewer assigned_to, q.priority, o.target_date due_date, 'Approved report' type,
          NULL jurisdiction, NULL vendor, NULL vendor_cost, NULL expected_cost,
          NULL client_price, NULL result, q.decision_note notes, q.issue_count, q.reviewer
        FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id
        JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id
        WHERE q.status='Approved' ORDER BY q.age DESC,q.id`);
    case "billing-exceptions":
      return rows(`
        SELECT b.id, 'BILL-'||b.id record_id, o.order_id, s.search_id, NULL qa_id,
          b.id billing_id, v.id vendor_id, c.name candidate, c.email candidate_email,
          c.dob candidate_dob, c.address candidate_address, c.aliases candidate_aliases,
          cl.name client, o.position, o.package, b.issue, b.status, o.aging,
          o.assigned_to, CASE WHEN b.vendor_cost>b.expected_cost THEN 'High' ELSE 'Normal' END priority,
          o.target_date due_date, COALESCE(s.type,'Order fee') type, s.jurisdiction, s.vendor,
          b.vendor_cost, b.expected_cost, b.client_price, NULL result, b.resolution_note notes,
          NULL issue_count, NULL reviewer
        FROM cp_billing b JOIN cp_orders o ON o.id=b.order_id
        JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id
        LEFT JOIN cp_searches s ON s.id=b.search_id LEFT JOIN cp_vendors v ON lower(v.name)=lower(s.vendor)
        WHERE b.status NOT IN ('Resolved','Invoiced') ORDER BY b.id`);
  }
}

export default async function QueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  if (!slugs.has(rawSlug)) notFound();
  const slug = rawSlug as QueueSlug;
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const vendors = rows("SELECT id,name,coverage,cost,quality,preferred FROM cp_vendors WHERE status='Active' ORDER BY preferred DESC,quality DESC,name");
  const templates = rows("SELECT template_key templateKey,name,subject,body FROM cp_message_templates WHERE audience='Candidate' AND status='Active' ORDER BY name");
  return (
    <QueueWorkspace
      slug={slug}
      meta={queueMeta[slug]}
      initialItems={queueRows(slug)}
      vendors={vendors}
      templates={templates}
      role={session?.role || ""}
    />
  );
}
