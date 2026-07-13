"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge, PageHead } from "@/components/Portal";

type DataRow = Record<string, string | number | null>;

type OrdersWorkspaceProps = {
  initialOrders: DataRow[];
  clients: DataRow[];
  assignees: DataRow[];
  role: string;
  initialQuery?: string;
};

const packages = ["Basic", "Standard", "Professional", "Healthcare"];

function text(value: unknown) {
  return String(value ?? "");
}

function statusTone(status: unknown) {
  const value = text(status);
  if (value === "Complete") return "green";
  if (value === "Quality Review") return "purple";
  if (value.includes("Action") || value === "On Hold") return "amber";
  return "blue";
}

function escapeCsv(value: unknown) {
  return `"${text(value).replaceAll('"', '""')}"`;
}

export default function OrdersWorkspace({
  initialOrders,
  clients,
  assignees,
  role,
  initialQuery = "",
}: OrdersWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState("All statuses");
  const [screeningPackage, setScreeningPackage] = useState("All packages");
  const [assignee, setAssignee] = useState("All assignees");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [page, setPage] = useState(1);
  const canManageOrders = role === "Administrator" || role === "Operations Specialist";

  const statuses = useMemo(
    () => [...new Set(initialOrders.map((order) => text(order.status)))].sort(),
    [initialOrders],
  );
  const assigneeNames = useMemo(
    () => [...new Set(assignees.map((item) => text(item.name)))],
    [assignees],
  );
  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialOrders.filter((order) => {
      const searchable = [
        order.order_id,
        order.candidate,
        order.candidate_email,
        order.client,
        order.position,
      ]
        .map(text)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (status === "All statuses" || text(order.status) === status) &&
        (screeningPackage === "All packages" ||
          text(order.package) === screeningPackage) &&
        (assignee === "All assignees" || text(order.assigned_to) === assignee)
      );
    });
  }, [assignee, initialOrders, query, screeningPackage, status]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const visibleOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [assignee, query, screeningPackage, status]);
  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function resetFilters() {
    setQuery("");
    setStatus("All statuses");
    setScreeningPackage("All packages");
    setAssignee("All assignees");
  }

  function exportCsv() {
    const columns: Array<[string, string]> = [
      ["order_id", "Order ID"],
      ["candidate", "Candidate"],
      ["candidate_email", "Candidate Email"],
      ["client", "Client"],
      ["position", "Position"],
      ["package", "Package"],
      ["order_date", "Order Date"],
      ["target_date", "Target Completion"],
      ["status", "Status"],
      ["assigned_to", "Assigned To"],
      ["priority", "Priority"],
    ];
    const csv = [
      columns.map(([, label]) => escapeCsv(label)).join(","),
      ...filteredOrders.map((order) =>
        columns.map(([key]) => escapeCsv(order[key])).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "clearpath-orders.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const activeFilterCount = [
    query,
    status === "All statuses" ? "" : status,
    screeningPackage === "All packages" ? "" : screeningPackage,
    assignee === "All assignees" ? "" : assignee,
  ].filter(Boolean).length;

  return (
    <div className="page orders-workspace">
      <PageHead
        eyebrow="SCREENING OPERATIONS"
        title="Orders"
        subtitle="Create, review, assign, and manage every screening order."
        actions={canManageOrders ? (
          <button
            type="button"
            className="btn primary orders-new-button"
            onClick={() => setNewOrderOpen(true)}
          >
            <span aria-hidden="true">＋</span> New Order
          </button>
        ) : undefined}
      />

      <section className="orders-filter-panel" aria-label="Order filters">
        <label className="orders-search-field">
          <span className="orders-filter-label">Search orders</span>
          <span className="orders-search-input">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Order, candidate, client, or position"
              type="search"
            />
          </span>
        </label>
        <label>
          <span className="orders-filter-label">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All statuses</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="orders-filter-label">Package</span>
          <select
            value={screeningPackage}
            onChange={(event) => setScreeningPackage(event.target.value)}
          >
            <option>All packages</option>
            {packages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="orders-filter-label">Assigned to</span>
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option>All assignees</option>
            <option>Unassigned</option>
            {assigneeNames.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="orders-clear-filters"
          onClick={resetFilters}
          disabled={!activeFilterCount}
        >
          Clear{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
      </section>

      <section className="card orders-results-card">
        <div className="orders-results-head">
          <div>
            <strong>{filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}</strong>
            <span>
              {filteredOrders.filter((order) => order.status === "In Progress").length} in
              progress · {filteredOrders.filter((order) => order.status === "Quality Review").length}{" "}
              quality review · {filteredOrders.filter((order) => order.status === "Complete").length}{" "}
              complete
            </span>
          </div>
          <button
            type="button"
            className="btn outline orders-export-button"
            onClick={exportCsv}
            disabled={!filteredOrders.length}
          >
            Export CSV
          </button>
        </div>

        {filteredOrders.length ? (
          <>
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Candidate</th>
                    <th>Client / Position</th>
                    <th>Package</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Aging</th>
                    <th><span className="sr-only">Open order</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={text(order.order_id)}>
                      <td>
                        <Link className="orders-id-link" href={`/app/orders/${order.order_id}`}>
                          {order.order_id}
                        </Link>
                        <small>Opened {order.order_date}</small>
                      </td>
                      <td>
                        <b>{order.candidate}</b>
                        <small>{order.candidate_email}</small>
                      </td>
                      <td>
                        <b>{order.client}</b>
                        <small>{order.position}</small>
                      </td>
                      <td>{order.package}</td>
                      <td>{order.target_date}</td>
                      <td>
                        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                      </td>
                      <td>{order.assigned_to}</td>
                      <td className={Number(order.aging) > 5 ? "red-text" : ""}>
                        {order.aging} days
                      </td>
                      <td>
                        <Link
                          className="orders-row-link"
                          href={`/app/orders/${order.order_id}`}
                          aria-label={`Open order ${order.order_id} for ${order.candidate}`}
                        >
                          Open <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="orders-mobile-list">
              {visibleOrders.map((order) => (
                <article key={text(order.order_id)} className="orders-mobile-card">
                  <div className="orders-mobile-card-head">
                    <Link href={`/app/orders/${order.order_id}`}>{order.order_id}</Link>
                    <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                  </div>
                  <h2>{order.candidate}</h2>
                  <p>{order.client}</p>
                  <dl>
                    <div><dt>Position</dt><dd>{order.position}</dd></div>
                    <div><dt>Package</dt><dd>{order.package}</dd></div>
                    <div><dt>Target</dt><dd>{order.target_date}</dd></div>
                    <div><dt>Assigned</dt><dd>{order.assigned_to}</dd></div>
                  </dl>
                  <Link className="btn outline wide" href={`/app/orders/${order.order_id}`}>
                    Open Order <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
            {pageCount > 1 && (
              <nav className="orders-pagination" aria-label="Orders pagination">
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredOrders.length)} of {filteredOrders.length}
                </span>
                <div>
                  <button type="button" className="btn outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>← Previous</button>
                  <strong>Page {page} of {pageCount}</strong>
                  <button type="button" className="btn outline" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next →</button>
                </div>
              </nav>
            )}
          </>
        ) : (
          <div className="orders-empty-state">
            <span aria-hidden="true">⌕</span>
            <h2>No orders match these filters</h2>
            <p>Clear the filters or search for a different candidate, client, or order.</p>
            <button type="button" className="btn outline" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      {newOrderOpen && canManageOrders && (
        <NewOrderDialog
          clients={clients}
          assignees={assigneeNames}
          onClose={() => setNewOrderOpen(false)}
        />
      )}
    </div>
  );
}

function NewOrderDialog({
  clients,
  assignees,
  onClose,
}: {
  clients: DataRow[];
  assignees: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      candidate: {
        name: text(form.get("candidateName")).trim(),
        dob: text(form.get("dob")),
        ssn: text(form.get("ssn")),
        email: text(form.get("email")).trim(),
        phone: text(form.get("phone")).trim(),
        address: text(form.get("address")).trim(),
        previousAddress: text(form.get("previousAddress")).trim(),
        aliases: text(form.get("aliases")).trim(),
      },
      clientId: Number(form.get("clientId")),
      position: text(form.get("position")).trim(),
      package: text(form.get("package")),
      orderDate: text(form.get("orderDate")),
      hiringLocation: text(form.get("hiringLocation")).trim(),
      recruiter: text(form.get("recruiter")).trim(),
      targetDate: text(form.get("targetDate")),
      assignedTo: text(form.get("assignedTo")),
    };
    try {
      const response = await fetch("/api/clearpath/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The order could not be created.");
      const orderId = body.order?.orderId || body.order?.order_id || body.orderId;
      onClose();
      if (orderId) router.push(`/app/orders/${orderId}`);
      else router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The order could not be created.");
      setSaving(false);
      closeButton.current?.focus();
    }
  }

  return (
    <div
      className="order-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="order-dialog order-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="order-dialog-head">
          <div>
            <p className="kicker">NEW SCREENING ORDER</p>
            <h2 id={titleId}>Create a screening order</h2>
            <p>Enter the candidate, client, package, and assignment details.</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close new order dialog"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset>
            <legend>Candidate information</legend>
            <div className="order-form-grid">
              <label>Full name<input name="candidateName" autoFocus required maxLength={140} /></label>
              <label>Date of birth<input name="dob" type="date" required /></label>
              <label>SSN last 4<input name="ssn" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="1234" /></label>
              <label>Email address<input name="email" type="email" required maxLength={180} /></label>
              <label>Phone number<input name="phone" type="tel" required maxLength={40} /></label>
              <label className="order-form-span">Current address<input name="address" required maxLength={240} /></label>
              <label>Previous address<input name="previousAddress" maxLength={240} /></label>
              <label>Aliases<input name="aliases" maxLength={180} placeholder="None reported" /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Order setup</legend>
            <div className="order-form-grid">
              <label>
                Client
                <select name="clientId" required defaultValue="">
                  <option value="" disabled>Select a client</option>
                  {clients.map((client) => (
                    <option value={text(client.id)} key={text(client.id)}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label>Position<input name="position" required maxLength={160} /></label>
              <label>
                Screening package
                <select name="package" defaultValue="Standard">
                  {packages.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>Hiring location<input name="hiringLocation" defaultValue="Denver, CO" required maxLength={180} /></label>
              <label>Recruiter<input name="recruiter" required maxLength={140} /></label>
              <label>Order date<input name="orderDate" type="date" defaultValue="2026-07-12" required /></label>
              <label>Target completion<input name="targetDate" type="date" required /></label>
              <label>
                Assigned to
                <select name="assignedTo" defaultValue="Unassigned">
                  <option>Unassigned</option>
                  {assignees.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="order-dialog-actions">
            <button type="button" className="btn outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn primary" disabled={saving}>{saving ? "Creating order…" : "Create Order"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
