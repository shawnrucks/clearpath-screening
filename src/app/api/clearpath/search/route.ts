import {NextRequest, NextResponse} from "next/server";
import {INTERNAL_ROLES, hasRole, sessionFromRequest} from "@/lib/auth";
import {rows} from "@/lib/clearpath";

type SearchResult = {
  type: "Order" | "Candidate" | "Search";
  label: string;
  meta: string;
  href: string;
};

export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  if (!hasRole(session, INTERNAL_ROLES)) return NextResponse.json({error: "Forbidden"}, {status: 403});

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({results: []});
  if (query.length > 80) return NextResponse.json({error: "Search query is too long"}, {status: 400});
  const pattern = `%${query}%`;

  const orders = rows(
    `SELECT o.order_id,c.name candidate,cl.name client,o.position
     FROM cp_orders o
     JOIN cp_candidates c ON c.id=o.candidate_id
     JOIN cp_clients cl ON cl.id=o.client_id
     WHERE o.order_id LIKE ? OR c.name LIKE ? OR cl.name LIKE ? OR o.position LIKE ?
     ORDER BY o.id DESC LIMIT 6`,
    pattern, pattern, pattern, pattern,
  ).map((row): SearchResult => ({
    type: "Order",
    label: `${row.order_id} · ${row.candidate}`,
    meta: `${row.client} · ${row.position}`,
    href: `/app/orders/${row.order_id}`,
  }));

  const searches = rows(
    `SELECT s.search_id,s.type,s.jurisdiction,o.order_id,c.name candidate
     FROM cp_searches s
     JOIN cp_orders o ON o.id=s.order_id
     JOIN cp_candidates c ON c.id=o.candidate_id
     WHERE s.search_id LIKE ? OR s.type LIKE ? OR s.jurisdiction LIKE ?
     ORDER BY s.id DESC LIMIT 6`,
    pattern, pattern, pattern,
  ).map((row): SearchResult => ({
    type: "Search",
    label: `${row.search_id} · ${row.type}`,
    meta: `${row.candidate} · ${row.jurisdiction}`,
    href: `/app/orders/${row.order_id}?tab=searches`,
  }));

  const candidates = rows(
    `SELECT c.id,c.name,c.email,o.order_id,cl.name client
     FROM cp_candidates c
     LEFT JOIN cp_orders o ON o.candidate_id=c.id
     LEFT JOIN cp_clients cl ON cl.id=o.client_id
     WHERE c.name LIKE ? OR c.email LIKE ?
     GROUP BY c.id
     ORDER BY c.id DESC LIMIT 5`,
    pattern, pattern,
  ).filter(row => row.order_id).map((row): SearchResult => ({
    type: "Candidate",
    label: String(row.name),
    meta: `${row.email} · ${row.client}`,
    href: `/app/orders/${row.order_id}?tab=candidate`,
  }));

  const seen = new Set<string>();
  const results = [...orders, ...searches, ...candidates].filter(result => {
    if (seen.has(result.href)) return false;
    seen.add(result.href);
    return true;
  }).slice(0, 12);
  return NextResponse.json({results});
}
