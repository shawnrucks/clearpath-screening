import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { rows } from "@/lib/clearpath";
import OrdersWorkspace from "./OrdersWorkspace";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string | string[] }>;
}) {
  const session = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const requestedClient = (await searchParams).client;
  const initialQuery = Array.isArray(requestedClient) ? requestedClient[0] : requestedClient || "";
  const orders = rows(`
    SELECT o.*, c.name AS candidate, c.email AS candidate_email,
      cl.name AS client, cl.industry AS client_industry
    FROM cp_orders o
    JOIN cp_candidates c ON c.id = o.candidate_id
    JOIN cp_clients cl ON cl.id = o.client_id
    ORDER BY o.id DESC
  `);
  const clients = rows(
    "SELECT id, name, industry FROM cp_clients WHERE status='Active' ORDER BY name",
  );
  const assignees = rows(
    "SELECT name, role FROM cp_users WHERE role IN ('Operations Specialist','Researcher / Vendor','Administrator') ORDER BY name",
  );

  return (
    <OrdersWorkspace
      initialOrders={orders}
      clients={clients}
      assignees={assignees}
      role={session?.role || ""}
      initialQuery={initialQuery}
    />
  );
}
