"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Portal";

type DataRow = Record<string, string | number | null>;

export type OrderTab =
  | "overview"
  | "searches"
  | "candidate"
  | "documents"
  | "communications"
  | "notes"
  | "billing"
  | "audit";

type DialogMode =
  | "edit-order"
  | "edit-candidate"
  | "add-search"
  | "edit-search"
  | "add-note"
  | "send-message"
  | "add-document"
  | "change-status"
  | "send-qa";

type DetailProps = {
  order: DataRow;
  searches: DataRow[];
  notes: DataRow[];
  communications: DataRow[];
  documents: DataRow[];
  billing: DataRow[];
  audit: DataRow[];
  clients: DataRow[];
  assignees: DataRow[];
  reviewers: DataRow[];
  vendors: DataRow[];
  activeTab: OrderTab;
  role: string;
};

const tabItems: Array<[OrderTab, string]> = [
  ["overview", "Overview"],
  ["searches", "Searches"],
  ["candidate", "Candidate"],
  ["documents", "Documents"],
  ["communications", "Communications"],
  ["notes", "Notes"],
  ["billing", "Billing"],
  ["audit", "Audit History"],
];

const orderStatuses = [
  "Candidate Action Required",
  "In Progress",
  "Quality Review",
  "Complete",
  "Client Action Required",
  "On Hold",
];
const searchStatuses = [
  "Not Started",
  "In Progress",
  "Awaiting Vendor",
  "Possible Record",
  "Completed",
];
const searchTypes = [
  "Social Security Number Trace",
  "County Criminal Search",
  "National Criminal Database",
  "Employment Verification",
  "Education Verification",
  "Motor Vehicle Record",
  "Drug Screening",
  "Healthcare Sanctions Search",
  "Professional License Verification",
];
const packages = ["Basic", "Standard", "Professional", "Healthcare"];

function text(value: unknown, fallback = "—") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function optionalText(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatBytes(value: unknown) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function statusTone(status: unknown) {
  const value = optionalText(status);
  if (["Complete", "Completed", "Resolved", "Invoiced"].includes(value)) return "green";
  if (value.includes("Action") || value === "On Hold" || value === "Awaiting Vendor") return "amber";
  if (value === "Quality Review" || value === "Possible Record") return "purple";
  return "blue";
}

function initials(name: unknown) {
  return text(name, "CP")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function OrderDetailWorkspace(props: DetailProps) {
  const { order, searches, activeTab, role } = props;
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [selectedSearch, setSelectedSearch] = useState<DataRow | null>(null);
  const [toast, setToast] = useState("");
  const completed = searches.filter((search) => search.status === "Completed").length;
  const progress = searches.length ? Math.round((completed / searches.length) * 100) : 0;
  const openSearches = searches.length - completed;
  const canManage = role === "Administrator" || role === "Operations Specialist";
  const canEditSearch = canManage || role === "Researcher / Vendor" || role === "Compliance Reviewer";
  const canAddDocument = canManage || role === "QA Reviewer" || role === "Researcher / Vendor";
  const tabCounts: Partial<Record<OrderTab, number>> = {
    searches: searches.length,
    documents: props.documents.length,
    communications: props.communications.length,
    notes: props.notes.length,
    billing: props.billing.length,
    audit: props.audit.length,
  };

  function openDialog(mode: DialogMode, search?: DataRow) {
    setSelectedSearch(search || null);
    setDialog(mode);
  }

  function saved(message: string) {
    setDialog(null);
    setSelectedSearch(null);
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <div className="page order-detail-page">
      <div className="order-record-header">
        <div className="order-record-title">
          <Link href="/app/orders" className="order-back-link">← Back to Orders</Link>
          <div className="order-title-line">
            <h1>{order.candidate}</h1>
            <Badge tone={statusTone(order.status)}>{order.status}</Badge>
          </div>
          <p>
            <strong>{order.order_id}</strong>
            <span className="order-meta-separator" aria-hidden="true">·</span>
            <span>{order.client}</span>
            <span className="order-meta-separator" aria-hidden="true">·</span>
            <span>{order.position}</span>
          </p>
        </div>
        <div className="order-header-actions">
          <button type="button" className="btn outline" onClick={() => openDialog("add-note")}>Add Note</button>
          {canManage && <button type="button" className="btn outline" onClick={() => openDialog("change-status")}>Change Status</button>}
          {canManage && <button type="button" className="btn primary" onClick={() => openDialog("send-qa")}>Send to QA</button>}
        </div>
      </div>

      <nav className="order-tabs" aria-label="Order detail sections" role="tablist">
        {tabItems.map(([value, label]) => (
          <Link
            key={value}
            href={`/app/orders/${order.order_id}?tab=${value}`}
            className={activeTab === value ? "active" : ""}
            role="tab"
            aria-selected={activeTab === value}
          >
            {label}
            {tabCounts[value] !== undefined && <span>{tabCounts[value]}</span>}
          </Link>
        ))}
      </nav>

      <main className="order-tab-panel" role="tabpanel">
        {activeTab === "overview" && (
          <OverviewTab
            {...props}
            progress={progress}
            completed={completed}
            openSearches={openSearches}
            openDialog={openDialog}
            canManage={canManage}
            canEditSearch={canEditSearch}
          />
        )}
        {activeTab === "searches" && (
          <SearchesTab searches={searches} openDialog={openDialog} canManage={canManage} canEditSearch={canEditSearch} />
        )}
        {activeTab === "candidate" && (
          <CandidateTab order={order} onEdit={canManage ? () => openDialog("edit-candidate") : undefined} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab documents={props.documents} onAdd={canAddDocument ? () => openDialog("add-document") : undefined} />
        )}
        {activeTab === "communications" && (
          <CommunicationsTab communications={props.communications} onAdd={canManage ? () => openDialog("send-message") : undefined} />
        )}
        {activeTab === "notes" && (
          <NotesTab notes={props.notes} onAdd={() => openDialog("add-note")} />
        )}
        {activeTab === "billing" && <BillingTab billing={props.billing} />}
        {activeTab === "audit" && <AuditTab audit={props.audit} />}
      </main>

      {dialog && (
        <OrderMutationDialog
          mode={dialog}
          order={order}
          search={selectedSearch}
          clients={props.clients}
          assignees={props.assignees}
          reviewers={props.reviewers}
          vendors={props.vendors}
          role={role}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {toast && <div className="order-toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function OverviewTab({
  order,
  searches,
  progress,
  completed,
  openSearches,
  openDialog,
  canManage,
  canEditSearch,
}: DetailProps & {
  progress: number;
  completed: number;
  openSearches: number;
  openDialog: (mode: DialogMode, search?: DataRow) => void;
  canManage: boolean;
  canEditSearch: boolean;
}) {
  return (
    <div className="order-detail-layout">
      <div className="order-detail-main">
        <section className="card order-content-card">
          <div className="order-card-head">
            <div><p className="kicker">ORDER DETAILS</p><h2>Order Overview</h2></div>
            {canManage && <button type="button" className="btn outline" onClick={() => openDialog("edit-order")}>Edit Order</button>}
          </div>
          <dl className="order-field-grid">
            <Field label="Client" value={order.client} />
            <Field label="Position" value={order.position} />
            <Field label="Screening package" value={order.package} />
            <Field label="Hiring location" value={order.hiring_location || "Denver, CO"} />
            <Field label="Order date" value={order.order_date} />
            <Field label="Target completion" value={order.target_date} />
            <Field label="Assigned to" value={order.assigned_to} />
            <Field label="Recruiter" value={order.recruiter || "Alyssa Moore"} />
          </dl>
        </section>

        <section className="card order-content-card">
          <div className="order-card-head">
            <div>
              <p className="kicker">SCREENING COMPONENTS</p>
              <h2>Screening Searches</h2>
              <span>{completed} of {searches.length} completed</span>
            </div>
            {canManage && <button type="button" className="btn outline" onClick={() => openDialog("add-search")}>＋ Add Search</button>}
          </div>
          {searches.length ? (
            <div className="order-search-list">
              {searches.map((search) => (
                <SearchRow key={text(search.search_id)} search={search} onOpen={canEditSearch ? () => openDialog("edit-search", search) : undefined} />
              ))}
            </div>
          ) : (
            <EmptyState title="No searches yet" body="Add the first screening search to begin this order." />
          )}
        </section>
      </div>

      <aside className="order-detail-sidebar">
        <section className="card order-content-card">
          <div className="order-card-head">
            <div><p className="kicker">CANDIDATE</p><h2>Candidate Information</h2></div>
            {canManage && <button type="button" className="btn outline" onClick={() => openDialog("edit-candidate")}>Edit</button>}
          </div>
          <div className="order-candidate-summary">
            <span className="order-avatar" aria-hidden="true">{initials(order.candidate)}</span>
            <div><h3>{order.candidate}</h3><p>{order.email}<br />{order.phone}</p></div>
          </div>
          <dl className="order-candidate-fields">
            <Field label="Date of birth" value={order.dob} />
            <Field label="SSN" value={order.ssn} />
            <Field label="Current address" value={order.address} />
            <Field label="Previous address" value={order.previous_address} />
            <Field label="Aliases" value={order.aliases} />
          </dl>
        </section>

        <section className="card order-health-card">
          <div className="order-card-head"><div><p className="kicker">PROGRESS</p><h2>Order Health</h2></div></div>
          <div className="order-health-score"><strong>{progress}%</strong><span>complete</span></div>
          <progress value={progress} max="100" aria-label={`${progress}% complete`} />
          <div className="order-health-facts">
            <div><b>{openSearches}</b><span>searches in progress</span></div>
            <div><b>{text(order.target_date)}</b><span>target completion</span></div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function SearchesTab({ searches, openDialog, canManage, canEditSearch }: { searches: DataRow[]; openDialog: (mode: DialogMode, search?: DataRow) => void; canManage: boolean; canEditSearch: boolean }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head">
        <div><p className="kicker">SCREENING COMPONENTS</p><h2>All Searches</h2><span>{searches.length} searches attached to this order</span></div>
        {canManage && <button type="button" className="btn primary" onClick={() => openDialog("add-search")}>＋ Add Search</button>}
      </div>
      {searches.length ? <div className="order-search-list order-search-list-full">{searches.map((search) => <SearchRow key={text(search.search_id)} search={search} onOpen={canEditSearch ? () => openDialog("edit-search", search) : undefined} expanded />)}</div> : <EmptyState title="No searches yet" body={canManage ? "Add a screening search to begin fulfillment." : "No screening searches are attached to this order."} />}
    </section>
  );
}

function SearchRow({ search, onOpen, expanded = false }: { search: DataRow; onOpen?: () => void; expanded?: boolean }) {
  const complete = search.status === "Completed";
  return (
    <article className={`order-search-row${expanded ? " expanded" : ""}`}>
      <span className={`order-search-icon ${complete ? "complete" : "active"}`} aria-hidden="true">{complete ? "✓" : "⌕"}</span>
      <div className="order-search-primary">
        <h3>{search.type}</h3>
        <p>{search.search_id} · {search.jurisdiction}</p>
        {expanded && <small>{text(search.result, "Result pending")}</small>}
      </div>
      <div className="order-search-status">
        <Badge tone={statusTone(search.status)}>{search.status}</Badge>
        <span>Due {text(search.due_date)}</span>
      </div>
      {expanded && <div className="order-search-vendor"><span>Vendor</span><b>{text(search.vendor, "Unassigned")}</b></div>}
      {onOpen && <button type="button" className="orders-row-link" onClick={onOpen} aria-label={`Open search ${search.search_id}`}>Open <span aria-hidden="true">→</span></button>}
    </article>
  );
}

function CandidateTab({ order, onEdit }: { order: DataRow; onEdit?: () => void }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">CANDIDATE PROFILE</p><h2>{order.candidate}</h2><span>Identity and contact information for this screening order</span></div>{onEdit && <button type="button" className="btn primary" onClick={onEdit}>Edit Candidate</button>}</div>
      <div className="order-profile-hero"><span className="order-avatar large" aria-hidden="true">{initials(order.candidate)}</span><div><h3>{order.candidate}</h3><p>{order.email} · {order.phone}</p></div></div>
      <dl className="order-field-grid order-profile-grid">
        <Field label="Date of birth" value={order.dob} />
        <Field label="SSN" value={order.ssn} />
        <Field label="Email" value={order.email} />
        <Field label="Phone" value={order.phone} />
        <Field label="Current address" value={order.address} />
        <Field label="Previous address" value={order.previous_address} />
        <Field label="Aliases" value={order.aliases} />
      </dl>
    </section>
  );
}

function DocumentsTab({ documents, onAdd }: { documents: DataRow[]; onAdd?: () => void }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">ORDER FILES</p><h2>Documents</h2><span>Authorization, results, and supporting document metadata</span></div>{onAdd && <button type="button" className="btn primary" onClick={onAdd}>＋ Add Document</button>}</div>
      {documents.length ? <div className="order-document-list">{documents.map((document, index) => <article key={text(document.id, String(index))}><span className="order-document-icon" aria-hidden="true">▤</span><div><h3>{text(document.name || document.file_name || document.title, "Order document")}</h3><p>{text(document.document_type || document.category || document.type, "Supporting document")} · {text(document.mime_type, "Recorded metadata")} · {formatBytes(document.size_bytes)}</p><small>Added {text(document.created_at || document.uploaded_at)} by {text(document.uploaded_by, "ClearPath team")}</small></div><Badge tone="green">Recorded</Badge></article>)}</div> : <EmptyState title="No documents have been added" body={onAdd ? "Add authorization, result, or supporting-document metadata to this order." : "No document metadata is attached to this order."} action={onAdd ? <button type="button" className="btn primary" onClick={onAdd}>Add Document</button> : undefined} />}
    </section>
  );
}

function CommunicationsTab({ communications, onAdd }: { communications: DataRow[]; onAdd?: () => void }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">CANDIDATE OUTREACH</p><h2>Communications</h2><span>Messages and documented contact with the candidate</span></div>{onAdd && <button type="button" className="btn primary" onClick={onAdd}>Send Candidate Message</button>}</div>
      {communications.length ? <div className="order-timeline">{communications.map((item, index) => <article key={text(item.id, String(index))}><span className="order-timeline-dot" aria-hidden="true">✉</span><div><div className="order-timeline-head"><h3>{text(item.subject, "Candidate message")}</h3><time>{text(item.sent_at || item.created_at)}</time></div><p>{text(item.body || item.message)}</p><small>{text(item.direction, "Outbound")} · {text(item.channel, "Portal Message")} · {text(item.sent_by || item.created_by, "ClearPath team")}</small></div></article>)}</div> : <EmptyState title="No candidate messages yet" body={onAdd ? "Send an in-system message and keep the communication attached to this order." : "No candidate communication is attached to this order."} action={onAdd ? <button type="button" className="btn primary" onClick={onAdd}>Send Candidate Message</button> : undefined} />}
    </section>
  );
}

function NotesTab({ notes, onAdd }: { notes: DataRow[]; onAdd: () => void }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">INTERNAL COLLABORATION</p><h2>Order Notes</h2><span>Internal notes are never exposed to the candidate or client</span></div><button type="button" className="btn primary" onClick={onAdd}>＋ Add Note</button></div>
      {notes.length ? <div className="order-timeline order-note-list">{notes.map((note, index) => <article key={text(note.id, String(index))}><span className="order-timeline-dot" aria-hidden="true">✎</span><div><div className="order-timeline-head"><h3>{text(note.created_by, "ClearPath team")}</h3><time>{text(note.created_at)}</time></div><p>{note.note}</p></div></article>)}</div> : <EmptyState title="No internal notes" body="Add the first operational note for this order." action={<button type="button" className="btn primary" onClick={onAdd}>Add Note</button>} />}
    </section>
  );
}

function BillingTab({ billing }: { billing: DataRow[] }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">ORDER FINANCIALS</p><h2>Billing</h2><span>Vendor costs, client pricing, and billing exceptions</span></div><Link className="btn outline" href="/app/billing">Open Billing Workspace</Link></div>
      {billing.length ? <div className="order-billing-list">{billing.map((item) => <article key={text(item.id)}><div><h3>{text(item.issue, "Billing item")}</h3><p>{text(item.search_id, "Order-level charge")} · {text(item.search_type, "Screening fee")}</p></div><dl><div><dt>Vendor cost</dt><dd>{money(item.vendor_cost)}</dd></div><div><dt>Expected</dt><dd>{money(item.expected_cost)}</dd></div><div><dt>Client price</dt><dd>{money(item.client_price)}</dd></div></dl><Badge tone={statusTone(item.status)}>{item.status}</Badge><Link className="orders-row-link" href={`/app/billing/${item.id}`}>Open <span aria-hidden="true">→</span></Link></article>)}</div> : <EmptyState title="No billing exceptions" body="This order has no fee exceptions requiring review." />}
    </section>
  );
}

function AuditTab({ audit }: { audit: DataRow[] }) {
  return (
    <section className="card order-content-card order-full-card">
      <div className="order-card-head"><div><p className="kicker">COMPLIANCE EVIDENCE</p><h2>Audit History</h2><span>Immutable order and search activity</span></div></div>
      {audit.length ? <div className="order-audit-list">{audit.map((item, index) => <article key={text(item.id, String(index))}><time>{text(item.ts)}</time><div><h3>{text(item.action)}</h3><p>{text(item.user)} · {text(item.role)}</p>{item.note && <small>{item.note}</small>}</div><div><Badge tone="blue">{text(item.entity_type)}</Badge><span>{text(item.entity_id)}</span></div></article>)}</div> : <EmptyState title="No audit events" body="Order changes will appear here as they are recorded." />}
    </section>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return <div><dt>{label}</dt><dd>{text(value)}</dd></div>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="order-empty-state"><span aria-hidden="true">◇</span><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function OrderMutationDialog({
  mode,
  order,
  search,
  clients,
  assignees,
  reviewers,
  vendors,
  role,
  onClose,
  onSaved,
}: {
  mode: DialogMode;
  order: DataRow;
  search: DataRow | null;
  clients: DataRow[];
  assignees: DataRow[];
  reviewers: DataRow[];
  vendors: DataRow[];
  role: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const config = useMemo(() => dialogConfig(mode, search), [mode, search]);

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
    let endpoint = "";
    let method = "POST";
    let body: Record<string, unknown> = {};
    if (mode === "edit-order") {
      endpoint = `/api/clearpath/orders/${order.order_id}`;
      method = "PATCH";
      body = {
        clientId: Number(form.get("clientId")),
        position: optionalText(form.get("position")),
        package: optionalText(form.get("package")),
        hiringLocation: optionalText(form.get("hiringLocation")),
        recruiter: optionalText(form.get("recruiter")),
        targetDate: optionalText(form.get("targetDate")),
        assignedTo: optionalText(form.get("assignedTo")),
      };
    } else if (mode === "edit-candidate") {
      endpoint = `/api/clearpath/candidates/${order.candidate_id}`;
      method = "PATCH";
      body = {
        name: optionalText(form.get("name")), dob: optionalText(form.get("dob")),
        email: optionalText(form.get("email")), phone: optionalText(form.get("phone")),
        address: optionalText(form.get("address")), previousAddress: optionalText(form.get("previousAddress")),
        aliases: optionalText(form.get("aliases")),
      };
    } else if (mode === "add-search") {
      endpoint = `/api/clearpath/orders/${order.order_id}/searches`;
      body = {
        type: optionalText(form.get("type")), jurisdiction: optionalText(form.get("jurisdiction")),
        vendor: optionalText(form.get("vendor")), dueDate: optionalText(form.get("dueDate")),
        clientPrice: Number(form.get("clientPrice") || 0),
      };
    } else if (mode === "edit-search" && search) {
      endpoint = `/api/clearpath/searches/${search.search_id}`;
      method = "PATCH";
      body = { status: optionalText(form.get("status")), result: optionalText(form.get("result")), notes: optionalText(form.get("notes")) };
      if (role === "Administrator" || role === "Operations Specialist") {
        body.vendor = optionalText(form.get("vendor"));
        body.dueDate = optionalText(form.get("dueDate"));
      } else if (role === "Researcher / Vendor") {
        body.dueDate = optionalText(form.get("dueDate"));
      }
    } else if (mode === "add-note") {
      endpoint = `/api/clearpath/orders/${order.order_id}/notes`;
      body = { note: optionalText(form.get("note")) };
    } else if (mode === "send-message") {
      endpoint = `/api/clearpath/orders/${order.order_id}/communications`;
      body = {
        recipientType: "Candidate",
        recipient: optionalText(order.email),
        channel: "Portal Message",
        subject: optionalText(form.get("subject")),
        body: optionalText(form.get("body")),
        direction: "Outbound",
        status: "Sent",
      };
    } else if (mode === "add-document") {
      endpoint = `/api/clearpath/orders/${order.order_id}/documents`;
      const file = form.get("file");
      if (!(file instanceof File) || !file.name) {
        setError("Choose a supported file so its metadata can be recorded.");
        setSaving(false);
        return;
      }
      body = {
        name: file.name,
        documentType: optionalText(form.get("documentType")),
        mimeType: file.type,
        sizeBytes: file.size,
        storageReference: `recorded-metadata:${file.name}`,
      };
    } else if (mode === "change-status") {
      endpoint = "/api/clearpath/action";
      body = { action: "Change Order Status", entityId: order.order_id, values: { "New Status": optionalText(form.get("status")) }, note: optionalText(form.get("note")) };
    } else if (mode === "send-qa") {
      endpoint = "/api/clearpath/action";
      body = { action: "Send Order to QA", entityId: order.order_id, values: { "Assigned Reviewer": optionalText(form.get("reviewer")) }, note: optionalText(form.get("note")) };
    }
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || "The change could not be saved.");
      onSaved(config.success);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
      setSaving(false);
      closeRef.current?.focus();
    }
  }

  return (
    <div className="order-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="order-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="order-dialog-head">
          <div><p className="kicker">{config.eyebrow}</p><h2 id={titleId}>{config.title}</h2><p>{config.description}</p></div>
          <button ref={closeRef} type="button" aria-label={`Close ${config.title}`} onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={submit}>
          <DialogFields mode={mode} order={order} search={search} clients={clients} assignees={assignees} reviewers={reviewers} vendors={vendors} role={role} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="order-dialog-actions"><button type="button" className="btn outline" onClick={onClose} disabled={saving}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : config.submit}</button></div>
        </form>
      </section>
    </div>
  );
}

function dialogConfig(mode: DialogMode, search: DataRow | null) {
  const configs: Record<DialogMode, { eyebrow: string; title: string; description: string; submit: string; success: string }> = {
    "edit-order": { eyebrow: "ORDER DETAILS", title: "Edit Order", description: "Update client, package, assignment, and timing.", submit: "Save Order", success: "Order details updated" },
    "edit-candidate": { eyebrow: "CANDIDATE PROFILE", title: "Edit Candidate", description: "Update identity and contact information for this order.", submit: "Save Candidate", success: "Candidate information updated" },
    "add-search": { eyebrow: "SCREENING COMPONENT", title: "Add Search", description: "Add a screening product and assign its initial fulfillment details.", submit: "Add Search", success: "Search added to order" },
    "edit-search": { eyebrow: "SCREENING COMPONENT", title: `Update ${text(search?.search_id, "Search")}`, description: "Record fulfillment status, vendor, result, and due date.", submit: "Save Search", success: "Search updated" },
    "add-note": { eyebrow: "INTERNAL COLLABORATION", title: "Add Internal Note", description: "This note is visible only to authorized ClearPath users.", submit: "Add Note", success: "Internal note added" },
    "send-message": { eyebrow: "CANDIDATE OUTREACH", title: "Send Candidate Message", description: "Send and retain an in-system message on this order.", submit: "Send Message", success: "Candidate message sent" },
    "add-document": { eyebrow: "ORDER FILES", title: "Add Document Metadata", description: "Choose a file to record its name, type, and size. File bytes are not uploaded in this demo.", submit: "Record Document", success: "Document metadata added" },
    "change-status": { eyebrow: "ORDER WORKFLOW", title: "Change Order Status", description: "Update the operational status and document the reason.", submit: "Change Status", success: "Order status updated" },
    "send-qa": { eyebrow: "QUALITY WORKFLOW", title: "Send Order to QA", description: "Choose a reviewer and route the order to quality review.", submit: "Send to QA", success: "Order sent to quality review" },
  };
  return configs[mode];
}

function DialogFields({ mode, order, search, clients, assignees, reviewers, vendors, role }: { mode: DialogMode; order: DataRow; search: DataRow | null; clients: DataRow[]; assignees: DataRow[]; reviewers: DataRow[]; vendors: DataRow[]; role: string }) {
  if (mode === "edit-order") return <div className="order-form-grid"><label>Client<select name="clientId" defaultValue={text(order.client_id)}>{clients.map((item) => <option key={text(item.id)} value={text(item.id)}>{item.name}</option>)}</select></label><label>Position<input name="position" defaultValue={optionalText(order.position)} required /></label><label>Package<select name="package" defaultValue={optionalText(order.package)}>{packages.map((item) => <option key={item}>{item}</option>)}</select></label><label>Hiring location<input name="hiringLocation" defaultValue={optionalText(order.hiring_location) || "Denver, CO"} required /></label><label>Recruiter<input name="recruiter" defaultValue={optionalText(order.recruiter) || "Alyssa Moore"} required /></label><label>Target completion<input name="targetDate" type="date" defaultValue={optionalText(order.target_date)} required /></label><label>Assigned to<select name="assignedTo" defaultValue={optionalText(order.assigned_to)}><option>Unassigned</option>{assignees.map((item) => <option key={text(item.name)}>{item.name}</option>)}</select></label></div>;
  if (mode === "edit-candidate") return <div className="order-form-grid"><label>Full name<input name="name" defaultValue={optionalText(order.candidate)} autoFocus required /></label><label>Date of birth<input name="dob" type="date" defaultValue={optionalText(order.dob)} required /></label><label>Email<input name="email" type="email" defaultValue={optionalText(order.email)} required /></label><label>Phone<input name="phone" defaultValue={optionalText(order.phone)} required /></label><label className="order-form-span">Current address<input name="address" defaultValue={optionalText(order.address)} required /></label><label>Previous address<input name="previousAddress" defaultValue={optionalText(order.previous_address)} /></label><label>Aliases<input name="aliases" defaultValue={optionalText(order.aliases)} /></label></div>;
  if (mode === "add-search") return <div className="order-form-grid"><label>Search type<select name="type" defaultValue="County Criminal Search" autoFocus>{searchTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Jurisdiction<input name="jurisdiction" placeholder="County, state, or nationwide" required /></label><label>Vendor<select name="vendor" defaultValue="Unassigned"><option>Unassigned</option>{vendors.map((item) => <option key={text(item.id)}>{item.name}</option>)}</select></label><label>Due date<input name="dueDate" type="date" required /></label><label>Client price<input name="clientPrice" type="number" min="0" step="0.01" defaultValue="65" required /></label></div>;
  if (mode === "edit-search" && search) {
    const manager = role === "Administrator" || role === "Operations Specialist";
    const researcher = role === "Researcher / Vendor";
    return <div className="order-form-grid"><label>Status<select name="status" defaultValue={optionalText(search.status)} autoFocus>{searchStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>{manager && <label>Vendor<select name="vendor" defaultValue={optionalText(search.vendor)}><option>Unassigned</option>{vendors.map((item) => <option key={text(item.id)}>{item.name}</option>)}</select></label>}{(manager || researcher) && <label>Due date<input name="dueDate" type="date" defaultValue={optionalText(search.due_date)} required /></label>}<label>Result<input name="result" defaultValue={optionalText(search.result)} /></label><label className="order-form-span">Search notes<textarea name="notes" defaultValue={optionalText(search.notes)} placeholder="Document fulfillment activity and context" /></label></div>;
  }
  if (mode === "add-note") return <label className="order-dialog-field">Internal note<textarea name="note" autoFocus required maxLength={4000} placeholder="Document the action, decision, owner, and next step" /></label>;
  if (mode === "send-message") return <div className="order-form-grid"><label className="order-form-span">Subject<input name="subject" autoFocus required maxLength={180} defaultValue={`ClearPath screening update — ${order.order_id}`} /></label><label className="order-form-span">Message<textarea name="body" required maxLength={5000} placeholder={`Write a message to ${order.candidate}`} /></label></div>;
  if (mode === "add-document") return <div className="order-form-grid"><label className="order-form-span">Choose file<input name="file" type="file" autoFocus required accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,application/pdf,image/png,image/jpeg,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /><span className="order-metadata-note">The demo records file metadata only. The selected file is not uploaded or stored.</span></label><label className="order-form-span">Document type<select name="documentType" defaultValue="Candidate Authorization"><option>Candidate Authorization</option><option>Court Record</option><option>Verification Evidence</option><option>Identity Document</option><option>QA Evidence</option><option>Other</option></select></label></div>;
  if (mode === "change-status") return <div className="order-form-grid"><label className="order-form-span">New status<select name="status" autoFocus defaultValue={optionalText(order.status)}>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</select></label><label className="order-form-span">Reason / internal note<textarea name="note" required placeholder="Explain why the order status is changing" /></label></div>;
  return <div className="order-form-grid"><label className="order-form-span">QA reviewer<select name="reviewer" autoFocus required defaultValue=""><option value="" disabled>Select a reviewer</option>{reviewers.map((item) => <option key={text(item.name)}>{item.name}</option>)}</select></label><label className="order-form-span">QA handoff note<textarea name="note" required placeholder="Summarize completed work and any items requiring review" /></label></div>;
}
