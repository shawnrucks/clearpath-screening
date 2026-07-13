"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { Badge, PageHead } from "@/components/Portal";

type DataRow = Record<string, string | number | null>;
export type QueueSlug =
  | "new-order-review"
  | "candidate-missing-information"
  | "unassigned-searches"
  | "verification-follow-up"
  | "overdue-searches"
  | "record-review"
  | "reports-ready-for-qa"
  | "reports-ready-to-release"
  | "billing-exceptions";

type QueueWorkspaceProps = {
  slug: QueueSlug;
  meta: { title: string; description: string; guidance: string };
  initialItems: DataRow[];
  vendors: DataRow[];
  templates: DataRow[];
  role: string;
};

type Attempt = {
  id: number;
  attemptType: string;
  outcome: string;
  nextFollowUp?: string;
  note: string;
  attemptedBy: string;
  attemptedAt: string;
};

const labels: Record<QueueSlug, string> = {
  "new-order-review": "Review Order",
  "candidate-missing-information": "Send Candidate Request",
  "unassigned-searches": "Assign Vendor",
  "verification-follow-up": "Log Verification Attempt",
  "overdue-searches": "Contact Vendor",
  "record-review": "Record Review Decision",
  "reports-ready-for-qa": "Open QA Review",
  "reports-ready-to-release": "Release Report",
  "billing-exceptions": "Resolve Billing Exception",
};

const outcomes = [
  "No Answer",
  "Left Message",
  "Contacted",
  "Information Requested",
  "Candidate Assistance Requested",
  "Verified",
  "Unable to Verify",
];

const criminalDecisions = [
  "Confirmed Match",
  "Possible Match",
  "Non-Match",
  "More Research Required",
  "Duplicate Record",
  "Send to Compliance Review",
];

function text(value: unknown) {
  return String(value ?? "");
}

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "—";
}

function priority(item: DataRow) {
  const value = text(item.priority);
  if (value === "Urgent" || value === "High") return value;
  return Number(item.aging || 0) >= 5 ? "High" : "Normal";
}

function priorityTone(value: string) {
  return value === "Urgent" ? "red" : value === "High" ? "amber" : "gray";
}

function statusTone(value: unknown) {
  const status = text(value);
  if (status === "Approved" || status === "Completed" || status === "Resolved") return "green";
  if (status.includes("Possible") || status.includes("Overdue")) return "red";
  if (status.includes("Review")) return "purple";
  if (status.includes("Action") || status === "Open" || status === "Not Started") return "amber";
  return "blue";
}

function canAct(slug: QueueSlug, role: string) {
  if (slug === "new-order-review" || slug === "reports-ready-for-qa") return true;
  if (slug === "candidate-missing-information" || slug === "unassigned-searches") {
    return role === "Administrator" || role === "Operations Specialist";
  }
  if (slug === "verification-follow-up") {
    return role === "Administrator" || role === "Operations Specialist" || role === "Researcher / Vendor";
  }
  if (slug === "record-review") {
    return role === "Administrator" || role === "Operations Specialist" || role === "Compliance Reviewer";
  }
  if (slug === "reports-ready-to-release") return role === "Administrator" || role === "QA Reviewer";
  if (slug === "billing-exceptions") {
    return role === "Administrator" || role === "Operations Specialist" || role === "Billing Specialist";
  }
  return Boolean(role);
}

export default function QueueWorkspace({
  slug,
  meta,
  initialItems,
  vendors,
  templates,
  role,
}: QueueWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [assignee, setAssignee] = useState("All assignees");
  const [selected, setSelected] = useState<DataRow | null>(null);
  const [toast, setToast] = useState("");

  const assignees = useMemo(
    () => [...new Set(initialItems.map((item) => text(item.assigned_to)).filter(Boolean))].sort(),
    [initialItems],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialItems.filter((item) => {
      const haystack = [
        item.record_id,
        item.order_id,
        item.candidate,
        item.client,
        item.position,
        item.type,
        item.jurisdiction,
        item.issue,
        item.vendor,
      ]
        .map(text)
        .join(" ")
        .toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (priorityFilter === "All priorities" || priority(item) === priorityFilter) &&
        (assignee === "All assignees" || text(item.assigned_to) === assignee)
      );
    });
  }, [assignee, initialItems, priorityFilter, query]);

  const activeFilters = [
    query,
    priorityFilter === "All priorities" ? "" : priorityFilter,
    assignee === "All assignees" ? "" : assignee,
  ].filter(Boolean).length;

  function resetFilters() {
    setQuery("");
    setPriorityFilter("All priorities");
    setAssignee("All assignees");
  }

  function openAction(item: DataRow) {
    if (slug === "new-order-review") return;
    if (slug === "reports-ready-for-qa") return;
    setSelected(item);
  }

  return (
    <div className="page queue-workspace">
      <PageHead
        eyebrow="PRIORITY QUEUES"
        title={meta.title}
        subtitle={meta.description}
        actions={<Link href="/app/queues" className="btn outline">← All Queues</Link>}
      />

      <section className="queue-guidance" aria-label="Workflow guidance">
        <span aria-hidden="true">i</span>
        <div><strong>How this queue works</strong><p>{meta.guidance}</p></div>
        <small>{role || "Read-only access"}</small>
      </section>

      <section className="queue-filter-panel" aria-label="Queue filters">
        <label className="queue-search-field">
          <span>Search this queue</span>
          <span className="queue-search-input"><i aria-hidden="true">⌕</i><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, candidate, client, search, or issue" /></span>
        </label>
        <label><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>All priorities</option><option>Urgent</option><option>High</option><option>Normal</option></select></label>
        <label><span>Assigned to</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>All assignees</option>{assignees.map((name) => <option key={name}>{name}</option>)}</select></label>
        <button type="button" className="queue-clear" onClick={resetFilters} disabled={!activeFilters}>Clear{activeFilters ? ` (${activeFilters})` : ""}</button>
      </section>

      <section className="card queue-results-card">
        <div className="queue-results-head">
          <div><strong>{filtered.length} {filtered.length === 1 ? "open item" : "open items"}</strong><span>{initialItems.length - filtered.length ? `${initialItems.length - filtered.length} hidden by filters` : "Sorted by operational priority"}</span></div>
          <span className="queue-live-indicator"><i aria-hidden="true" /> Live operational data</span>
        </div>

        {filtered.length ? (
          <>
            <div className="queue-table-wrap">
              <table className="queue-table">
                <thead><tr><th>Priority</th><th>Record</th><th>Candidate</th><th>Client / Work</th><th>Issue / Jurisdiction</th><th>Status</th><th>Due / Age</th><th>Assigned to</th><th><span className="sr-only">Action</span></th></tr></thead>
                <tbody>{filtered.map((item) => (
                  <QueueRow key={`${item.record_id}-${item.id}`} item={item} slug={slug} role={role} openAction={openAction} />
                ))}</tbody>
              </table>
            </div>
            <div className="queue-mobile-list">{filtered.map((item) => (
              <QueueMobileCard key={`${item.record_id}-${item.id}`} item={item} slug={slug} role={role} openAction={openAction} />
            ))}</div>
          </>
        ) : (
          <div className="queue-empty"><span aria-hidden="true">✓</span><h2>{initialItems.length ? "No matching work" : "Queue is clear"}</h2><p>{initialItems.length ? "Adjust or clear the active filters." : "There are no open items requiring this workflow."}</p>{Boolean(activeFilters) && <button type="button" className="btn outline" onClick={resetFilters}>Clear filters</button>}</div>
        )}
      </section>

      {selected && (
        <QueueActionDialog
          slug={slug}
          item={selected}
          vendors={vendors}
          templates={templates}
          close={() => setSelected(null)}
          completed={(message) => { setSelected(null); setToast(message); window.setTimeout(() => setToast(""), 3500); }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function RecordLinks({ item }: { item: DataRow }) {
  return (
    <div className="queue-record-links">
      {item.search_id ? <Link href={`/app/orders/${text(item.order_id)}?tab=searches`}>{text(item.search_id)}</Link> : item.qa_id ? <Link href={`/app/quality-review?qa=${text(item.qa_id)}`}>{text(item.qa_id)}</Link> : <Link href={`/app/orders/${text(item.order_id)}`}>{text(item.record_id)}</Link>}
      {item.search_id && <Link className="queue-order-link" href={`/app/orders/${text(item.order_id)}`}>{text(item.order_id)}</Link>}
    </div>
  );
}

function ActionControl({ item, slug, role, openAction }: { item: DataRow; slug: QueueSlug; role: string; openAction: (item: DataRow) => void }) {
  if (slug === "new-order-review") return <Link className="queue-action" href={`/app/orders/${text(item.order_id)}`}>{labels[slug]} →</Link>;
  if (slug === "reports-ready-for-qa") return <Link className="queue-action" href={`/app/quality-review?qa=${text(item.qa_id)}`}>{labels[slug]} →</Link>;
  const allowed = canAct(slug, role);
  return allowed ? <button type="button" className="queue-action" onClick={() => openAction(item)}>{labels[slug]} →</button> : <span className="queue-read-only" title={`Your ${role || "current"} role can view but cannot complete this workflow.`}>View only</span>;
}

function QueueRow({ item, slug, role, openAction }: { item: DataRow; slug: QueueSlug; role: string; openAction: (item: DataRow) => void }) {
  const age = Number(item.aging || 0);
  return (
    <tr>
      <td><Badge tone={priorityTone(priority(item))}>{priority(item).toUpperCase()}</Badge></td>
      <td><RecordLinks item={item} /></td>
      <td><strong>{text(item.candidate)}</strong><small>{text(item.position)}</small></td>
      <td><strong>{text(item.client)}</strong><small>{text(item.type || item.package)}</small></td>
      <td><span>{text(item.issue || item.result || "No exception noted")}</span><small>{text(item.jurisdiction)}</small></td>
      <td><Badge tone={statusTone(item.status)}>{text(item.status)}</Badge></td>
      <td className={slug === "overdue-searches" ? "queue-overdue" : ""}><strong>{text(item.due_date) || "—"}</strong><small>{age ? `${age} day${age === 1 ? "" : "s"} open` : "Opened today"}</small></td>
      <td>{text(item.assigned_to || "Unassigned")}</td>
      <td><ActionControl item={item} slug={slug} role={role} openAction={openAction} /></td>
    </tr>
  );
}

function QueueMobileCard({ item, slug, role, openAction }: { item: DataRow; slug: QueueSlug; role: string; openAction: (item: DataRow) => void }) {
  return (
    <article className="queue-mobile-card">
      <div className="queue-mobile-card-head"><RecordLinks item={item} /><Badge tone={priorityTone(priority(item))}>{priority(item).toUpperCase()}</Badge></div>
      <h2>{text(item.candidate)}</h2><p>{text(item.client)} · {text(item.type || item.package)}</p>
      <dl><div><dt>Status</dt><dd><Badge tone={statusTone(item.status)}>{text(item.status)}</Badge></dd></div><div><dt>Due</dt><dd>{text(item.due_date) || "—"}</dd></div><div><dt>Assigned</dt><dd>{text(item.assigned_to || "Unassigned")}</dd></div><div><dt>Issue</dt><dd>{text(item.issue || item.result || "No exception noted")}</dd></div></dl>
      <ActionControl item={item} slug={slug} role={role} openAction={openAction} />
    </article>
  );
}

function QueueActionDialog({ slug, item, vendors, templates, close, completed }: { slug: QueueSlug; item: DataRow; vendors: DataRow[]; templates: DataRow[]; close: () => void; completed: (message: string) => void }) {
  const router = useRouter();
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [templateKey, setTemplateKey] = useState(text(templates[0]?.templateKey));
  const [followUpDate, setFollowUpDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("Candidate Action Required");
  const [note, setNote] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorCost, setVendorCost] = useState("");
  const [dueDate, setDueDate] = useState(text(item.due_date));
  const [attemptType, setAttemptType] = useState("Phone");
  const [outcome, setOutcome] = useState("No Answer");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [subject, setSubject] = useState(`Status request for ${text(item.search_id)}`);
  const [body, setBody] = useState(`Please provide a status update and expected completion date for ${text(item.search_id)} (${text(item.candidate)}).`);
  const [decision, setDecision] = useState("Possible Match");
  const [billingMode, setBillingMode] = useState<"resolve" | "approval">("resolve");
  const [amount, setAmount] = useState(text(item.expected_cost || item.vendor_cost));
  const [reason, setReason] = useState(text(item.issue));

  const terminalOutcome = outcome === "Verified" || outcome === "Unable to Verify";
  const selectedTemplate = templates.find((template) => text(template.templateKey) === templateKey);
  const selectedVendor = vendors.find((vendor) => text(vendor.id) === vendorId);
  const previewSubject = text(selectedTemplate?.subject)
    .replaceAll("{{candidateName}}", text(item.candidate))
    .replaceAll("{{clientName}}", text(item.client))
    .replaceAll("{{orderId}}", text(item.order_id));
  const previewBody = text(selectedTemplate?.body)
    .replaceAll("{{candidateName}}", text(item.candidate))
    .replaceAll("{{clientName}}", text(item.client))
    .replaceAll("{{orderId}}", text(item.order_id));

  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === "Escape") close(); }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [close]);

  useEffect(() => {
    if (slug !== "verification-follow-up") return;
    fetch(`/api/clearpath/searches/${text(item.search_id)}/attempts`)
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load attempt history")))
      .then((payload) => setAttempts(Array.isArray(payload.attempts) ? payload.attempts : []))
      .catch(() => setAttempts([]));
  }, [item.search_id, slug]);

  function chooseVendor(value: string) {
    setVendorId(value);
    const vendor = vendors.find((option) => text(option.id) === value);
    if (vendor) setVendorCost(text(vendor.cost));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let url = "";
      let method = "POST";
      let payload: Record<string, unknown> = {};
      if (slug === "candidate-missing-information") {
        url = `/api/clearpath/orders/${text(item.order_id)}/candidate-request`;
        payload = { templateKey, followUpDate, orderStatus, note };
      } else if (slug === "unassigned-searches") {
        if (!selectedVendor) throw new Error("Select an approved vendor");
        url = `/api/clearpath/searches/${text(item.search_id)}`;
        method = "PATCH";
        payload = { vendor: text(selectedVendor.name), vendorCost: Number(vendorCost), dueDate, note };
      } else if (slug === "verification-follow-up") {
        url = `/api/clearpath/searches/${text(item.search_id)}/attempts`;
        payload = { attemptType, outcome, nextFollowUp: terminalOutcome ? undefined : followUpDate, note };
      } else if (slug === "overdue-searches") {
        if (!item.vendor_id) throw new Error("This search has no active vendor record to contact");
        url = `/api/clearpath/vendors/${item.vendor_id}/messages`;
        payload = { subject, body, searchId: text(item.search_id), followUpDate };
      } else if (slug === "record-review") {
        url = `/api/clearpath/searches/${text(item.search_id)}/criminal-review`;
        payload = { decision, note };
      } else if (slug === "reports-ready-to-release") {
        url = `/api/clearpath/qa/${text(item.qa_id)}/decision`;
        payload = { decision: "Release Report", note };
      } else if (slug === "billing-exceptions") {
        url = `/api/clearpath/billing/${item.billing_id}/${billingMode === "resolve" ? "resolve" : "approval-request"}`;
        payload = billingMode === "resolve"
          ? { correctedFee: Number(amount), note }
          : { requestedAmount: Number(amount), reason, note };
      } else {
        throw new Error("This workflow opens from its dedicated record page");
      }
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || "Unable to save this workflow");
      router.refresh();
      completed(`${labels[slug]} saved for ${text(item.record_id)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this workflow");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <form className="modal queue-action-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <div className="modal-head"><div><p className="kicker">{text(item.record_id)}</p><h2 id={titleId}>{labels[slug]}</h2><p>{text(item.candidate)} · {text(item.client)}</p></div><button type="button" aria-label="Close dialog" onClick={close}>×</button></div>
        <div className="queue-dialog-context"><span><small>Order</small><Link href={`/app/orders/${text(item.order_id)}`}>{text(item.order_id)}</Link></span>{item.search_id && <span><small>Search</small><Link href={`/app/orders/${text(item.order_id)}?tab=searches`}>{text(item.search_id)}</Link></span>}<span><small>Current status</small><strong>{text(item.status)}</strong></span></div>

        {slug === "candidate-missing-information" && <>
          <label>Candidate message template<select required value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>{templates.map((template) => <option value={text(template.templateKey)} key={text(template.templateKey)}>{text(template.name)}</option>)}</select></label>
          {selectedTemplate && <div className="queue-message-preview"><strong>{previewSubject}</strong><p>{previewBody}</p></div>}
          <div className="queue-form-grid"><label>Follow-up date<input required type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label><label>Order status<select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option>Candidate Action Required</option><option>In Progress</option><option>On Hold</option></select></label></div>
          <label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What information is missing and why?" /></label>
        </>}

        {slug === "unassigned-searches" && <>
          <label>Approved vendor<select required value={vendorId} onChange={(event) => chooseVendor(event.target.value)}><option value="">Select an approved vendor</option>{vendors.map((vendor) => <option value={text(vendor.id)} key={text(vendor.id)}>{text(vendor.name)} · {text(vendor.coverage)} · {money(vendor.cost)}</option>)}</select></label>
          {selectedVendor && <p className="queue-form-hint">Quality score {text(selectedVendor.quality)}%{Number(selectedVendor.preferred) ? " · Preferred vendor" : ""}</p>}
          <div className="queue-form-grid"><label>Confirmed vendor cost<input required min="0" step="0.01" type="number" value={vendorCost} onChange={(event) => setVendorCost(event.target.value)} /></label><label>Due date<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
          <label>Assignment note<textarea required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Document jurisdiction, turnaround, or assignment instructions." /></label>
        </>}

        {slug === "verification-follow-up" && <>
          <div className="queue-form-grid"><label>Attempt type<select value={attemptType} onChange={(event) => setAttemptType(event.target.value)}><option>Phone</option><option>Email</option><option>Candidate Assistance</option></select></label><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}>{outcomes.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          {!terminalOutcome && <label>Next follow-up date<input required type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>}
          <label>Attempt note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Who was contacted and what happened?" /></label>
          <div className="queue-attempt-history"><strong>Recent attempts</strong>{attempts.length ? attempts.slice(0, 3).map((attempt) => <div key={attempt.id}><span>{attempt.attemptType} · {attempt.outcome}</span><small>{attempt.attemptedBy} · {attempt.attemptedAt}{attempt.nextFollowUp ? ` · Follow up ${attempt.nextFollowUp}` : ""}</small></div>) : <p>No prior attempts are logged.</p>}</div>
        </>}

        {slug === "overdue-searches" && <>
          <div className="queue-vendor-recipient"><small>Recipient</small><strong>{text(item.vendor)}</strong><span>{text(item.vendor_contact) || "Active vendor contact"} · Stored in the vendor communication history</span></div>
          <label>Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label>Message<textarea required value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <label>Follow-up date<input required type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
        </>}

        {slug === "record-review" && <>
          <div className="identifier-compare"><div><h3>Candidate record</h3><p><small>Name</small><strong>{text(item.candidate)}</strong></p><p><small>Date of birth</small><strong>{text(item.candidate_dob)}</strong></p><p><small>Address</small><strong>{text(item.candidate_address)}</strong></p><p><small>Aliases</small><strong>{text(item.candidate_aliases)}</strong></p></div><div><h3>Search result</h3><p><small>Jurisdiction</small><strong>{text(item.jurisdiction)}</strong></p><p><small>Result</small><strong>{text(item.result)}</strong></p><p><small>Supporting note</small><strong>{text(item.notes || "No additional vendor note")}</strong></p></div></div>
          <label>Review decision<select value={decision} onChange={(event) => setDecision(event.target.value)}>{criminalDecisions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Comparison rationale<textarea required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Document the identifiers compared and the basis for this decision." /></label>
        </>}

        {slug === "reports-ready-to-release" && <div className="queue-release-confirm"><span aria-hidden="true">✓</span><h3>Release {text(item.qa_id)}?</h3><p>This changes the exact QA record to Released and records your identity in its audit trail.</p><label>Release note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add final release context." /></label></div>}

        {slug === "billing-exceptions" && <>
          <div className="billing-choice" role="radiogroup" aria-label="Billing workflow"><label className={billingMode === "resolve" ? "selected" : ""}><input type="radio" name="billing-mode" checked={billingMode === "resolve"} onChange={() => setBillingMode("resolve")} /><span><strong>Resolve corrected fee</strong><small>Save the corrected vendor fee and close this exception.</small></span></label><label className={billingMode === "approval" ? "selected" : ""}><input type="radio" name="billing-mode" checked={billingMode === "approval"} onChange={() => setBillingMode("approval")} /><span><strong>Request client approval</strong><small>Create a pending approval request with a business reason.</small></span></label></div>
          <div className="billing-comparison"><span><small>Vendor cost</small><strong>{money(item.vendor_cost)}</strong></span><span><small>Expected cost</small><strong>{money(item.expected_cost)}</strong></span><span><small>Client price</small><strong>{money(item.client_price)}</strong></span></div>
          <label>{billingMode === "resolve" ? "Corrected fee" : "Requested amount"}<input required min={billingMode === "approval" ? "0.01" : "0"} step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          {billingMode === "approval" && <label>Approval reason<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
          <label>{billingMode === "resolve" ? "Resolution note" : "Additional note"}<textarea required={billingMode === "resolve"} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Document the fee comparison and decision." /></label>
        </>}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn outline" onClick={close}>Cancel</button><button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : slug === "billing-exceptions" && billingMode === "approval" ? "Request Client Approval" : labels[slug]}</button></div>
      </form>
    </div>
  );
}
