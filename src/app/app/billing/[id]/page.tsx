import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, PageHead } from "@/components/Portal";
import { rows } from "@/lib/clearpath";
import InvoiceComposer from "./InvoiceComposer";

export default async function BillingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const record = rows(
    `SELECT b.*,o.order_id,o.position,o.package,o.order_date,o.status order_status,
    c.name candidate,c.email candidate_email,cl.name client,cl.industry,
    s.search_id,s.type search_type,s.jurisdiction,s.vendor,s.court_fee,s.status search_status
    FROM cp_billing b JOIN cp_orders o ON o.id=b.order_id JOIN cp_candidates c ON c.id=o.candidate_id
    JOIN cp_clients cl ON cl.id=o.client_id LEFT JOIN cp_searches s ON s.id=b.search_id WHERE b.id=?`,
    Number(id),
  )[0];
  if (!record) notFound();
  const money = (value: unknown) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(value || 0));
  const variance =
      Number(record.vendor_cost || 0) - Number(record.expected_cost || 0),
    margin =
      Number(record.client_price || 0) -
      Number(record.vendor_cost || 0) -
      Number(record.court_fee || 0);
  return (
    <div className="page billing-detail">
      <Link href="/app/billing" className="back-link">
        ← Back to billing
      </Link>
      <PageHead
        eyebrow={`BILLING EXCEPTION · BL-${id.padStart(4, "0")}`}
        title={String(record.issue)}
        subtitle={`${record.client} · ${record.order_id}`}
      />
      <div className="billing-detail-grid">
        <div className="billing-detail-main">
          <section className="card billing-context">
            <div className="card-head">
              <div>
                <h2>Exception review</h2>
                <p>
                  Confirm the source record and reconcile the fee before
                  invoicing.
                </p>
              </div>
              <Badge tone={record.status === "Open" ? "amber" : "green"}>
                {record.status}
              </Badge>
            </div>
            <div className="billing-context-grid">
              <div>
                <small>Client</small>
                <b>{record.client}</b>
                <span>{record.industry}</span>
              </div>
              <div>
                <small>Candidate</small>
                <b>{record.candidate}</b>
                <span>{record.candidate_email}</span>
              </div>
              <div>
                <small>Order</small>
                <Link href={`/app/orders/${record.order_id}`}>
                  {record.order_id} →
                </Link>
                <span>
                  {record.package} · {record.position}
                </span>
              </div>
              <div>
                <small>Search</small>
                <b>{record.search_id || "Order-level"}</b>
                <span>{record.search_type || "No component search"}</span>
              </div>
              <div>
                <small>Vendor</small>
                <b>{record.vendor || "Not assigned"}</b>
                <span>{record.jurisdiction || "—"}</span>
              </div>
              <div>
                <small>Search status</small>
                <b>{record.search_status || record.order_status}</b>
                <span>Ordered {record.order_date}</span>
              </div>
            </div>
          </section>
          <section className="card fee-comparison">
            <div className="card-head">
              <div>
                <h2>Fee comparison</h2>
                <p>Source costs and the amount charged to the client</p>
              </div>
            </div>
            <div className="fee-grid">
              <div>
                <span>Expected vendor cost</span>
                <b>{money(record.expected_cost)}</b>
              </div>
              <div>
                <span>Actual vendor cost</span>
                <b>{money(record.vendor_cost)}</b>
                <small className={variance > 0 ? "red-text" : ""}>
                  {variance > 0 ? "+" : ""}
                  {money(variance)} variance
                </small>
              </div>
              <div>
                <span>Court / access fee</span>
                <b>{money(record.court_fee)}</b>
              </div>
              <div className="fee-client">
                <span>Client price</span>
                <b>{money(record.client_price)}</b>
                <small>{money(margin)} estimated margin</small>
              </div>
            </div>
          </section>
        </div>
        <InvoiceComposer
          billingId={id}
          client={String(record.client)}
          orderId={String(record.order_id)}
          defaultDescription={`${record.search_type || record.package} — ${record.order_id}`}
          defaultAmount={Number(record.client_price || 0)}
        />
      </div>
    </div>
  );
}
