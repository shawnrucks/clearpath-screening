import Link from "next/link";
import { Badge, PageHead } from "@/components/Portal";
import { rows } from "@/lib/clearpath";

const money = (value: unknown) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value || 0),
  );

export default function BillingPage() {
  const exceptions =
    rows(`SELECT b.id,b.issue,b.vendor_cost,b.expected_cost,b.client_price,b.status,
    o.order_id,o.position,c.name candidate,cl.name client,s.search_id,s.type search_type,s.vendor
    FROM cp_billing b
    JOIN cp_orders o ON o.id=b.order_id
    JOIN cp_candidates c ON c.id=o.candidate_id
    JOIN cp_clients cl ON cl.id=o.client_id
    LEFT JOIN cp_searches s ON s.id=b.search_id
    ORDER BY CASE b.status WHEN 'Open' THEN 0 ELSE 1 END,b.id`);
  const open = exceptions.filter((x) => x.status === "Open"),
    variance = open.reduce(
      (sum, x) =>
        sum +
        Math.abs(Number(x.vendor_cost || 0) - Number(x.expected_cost || 0)),
      0,
    ),
    ready = exceptions.filter((x) => x.status === "Resolved").length;
  return (
    <div className="page billing-page">
      <PageHead
        eyebrow="FINANCE OPERATIONS"
        title="Billing & Invoicing"
        subtitle="Review cost exceptions, confirm client pricing, and create auditable invoices."
      />
      <div className="billing-metrics" aria-label="Billing summary">
        <article>
          <span>Open exceptions</span>
          <b>{open.length}</b>
          <small>Require review</small>
        </article>
        <article>
          <span>Cost variance</span>
          <b>{money(variance)}</b>
          <small>Across open items</small>
        </article>
        <article>
          <span>Resolved items</span>
          <b>{ready}</b>
          <small>Ready for invoicing</small>
        </article>
      </div>
      <section className="card billing-list">
        <div className="card-head">
          <div>
            <h2>Billing exceptions</h2>
            <p>
              Vendor fees, expected costs, and client prices requiring
              reconciliation
            </p>
          </div>
          <Badge tone={open.length ? "amber" : "green"}>
            {open.length} open
          </Badge>
        </div>
        <div className="billing-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Exception</th>
                <th>Client / candidate</th>
                <th>Order / search</th>
                <th>Vendor</th>
                <th>Vendor cost</th>
                <th>Expected</th>
                <th>Client price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((x) => {
                const variance =
                  Number(x.vendor_cost || 0) - Number(x.expected_cost || 0);
                return (
                  <tr key={String(x.id)}>
                    <td>
                      <b>BL-{String(x.id).padStart(4, "0")}</b>
                      <small>{x.issue}</small>
                    </td>
                    <td>
                      <b>{x.client}</b>
                      <small>{x.candidate}</small>
                    </td>
                    <td>
                      <Link href={`/app/orders/${x.order_id}`}>
                        {x.order_id}
                      </Link>
                      <small>{x.search_id || "Order-level exception"}</small>
                    </td>
                    <td>{x.vendor || "—"}</td>
                    <td>
                      <b className={variance > 0 ? "red-text" : ""}>
                        {money(x.vendor_cost)}
                      </b>
                      {variance !== 0 && (
                        <small>
                          {variance > 0 ? "+" : ""}
                          {money(variance)} variance
                        </small>
                      )}
                    </td>
                    <td>{money(x.expected_cost)}</td>
                    <td>
                      <b>{money(x.client_price)}</b>
                    </td>
                    <td>
                      <Badge tone={x.status === "Open" ? "amber" : "green"}>
                        {x.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className="table-action"
                        href={`/app/billing/${x.id}`}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
