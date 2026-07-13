import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rows } from "@/lib/clearpath";
import OrderDetailWorkspace, { type OrderTab } from "./OrderDetailWorkspace";

const tabs = new Set<OrderTab>([
  "overview",
  "searches",
  "candidate",
  "documents",
  "communications",
  "notes",
  "billing",
  "audit",
]);

function optionalRows(sql: string, ...args: unknown[]) {
  try {
    return rows(sql, ...args);
  } catch {
    return [];
  }
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const requestedTab = (await searchParams).tab;
  const tabValue = Array.isArray(requestedTab) ? requestedTab[0] : requestedTab;
  const activeTab = tabs.has(tabValue as OrderTab)
    ? (tabValue as OrderTab)
    : "overview";
  const order = rows(
    `SELECT o.*, c.name AS candidate, c.dob, c.ssn, c.email, c.phone,
      c.address, c.previous_address, c.aliases,
      cl.name AS client, cl.industry AS client_industry
    FROM cp_orders o
    JOIN cp_candidates c ON c.id=o.candidate_id
    JOIN cp_clients cl ON cl.id=o.client_id
    WHERE o.order_id=?`,
    id,
  )[0];
  if (!order) notFound();

  const searches = rows(
    "SELECT * FROM cp_searches WHERE order_id=? ORDER BY id",
    order.id,
  );
  const notes = rows(
    "SELECT * FROM cp_notes WHERE entity_type='Order' AND entity_id=? ORDER BY id DESC",
    id,
  );
  const communications = optionalRows(
    "SELECT * FROM cp_communications WHERE order_id IN (?,?) ORDER BY id DESC",
    order.id,
    id,
  );
  const documents = optionalRows(
    "SELECT * FROM cp_documents WHERE order_id IN (?,?) ORDER BY id DESC",
    order.id,
    id,
  );
  const billing = rows(
    `SELECT b.*, s.search_id, s.type AS search_type
     FROM cp_billing b
     LEFT JOIN cp_searches s ON s.id=b.search_id
     WHERE b.order_id=? ORDER BY b.id DESC`,
    order.id,
  );
  const audit = rows(
    `SELECT * FROM cp_audit
     WHERE entity_id=? OR entity_id IN (
       SELECT search_id FROM cp_searches WHERE order_id=?
     )
     ORDER BY id DESC LIMIT 100`,
    id,
    order.id,
  );
  const clients = rows(
    "SELECT id,name,industry FROM cp_clients WHERE status='Active' ORDER BY name",
  );
  const assignees = rows(
    "SELECT name,role FROM cp_users WHERE role IN ('Operations Specialist','Researcher / Vendor','Administrator') ORDER BY name",
  );
  const reviewers = rows(
    "SELECT name,role FROM cp_users WHERE role IN ('QA Reviewer','Administrator') ORDER BY name",
  );
  const vendors = rows(
    "SELECT id,name,coverage FROM cp_vendors WHERE status='Active' ORDER BY name",
  );

  return (
    <OrderDetailWorkspace
      order={order}
      searches={searches}
      notes={notes}
      communications={communications}
      documents={documents}
      billing={billing}
      audit={audit}
      clients={clients}
      assignees={assignees}
      reviewers={reviewers}
      vendors={vendors}
      activeTab={activeTab}
      role={session?.role || ""}
    />
  );
}
