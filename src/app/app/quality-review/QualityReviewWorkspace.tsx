"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge, PageHead } from "@/components/Portal";

type DataRow = Record<string, string | number | null>;
type ChecklistItem = { key: string; label: string; completed: boolean; note: string; updatedBy?: string | null; updatedAt?: string | null };

const decisions = ["Approve", "Return to Operations", "Request Additional Research", "Escalate to Compliance", "Release Report"];
const returnReasons = ["Missing Document", "Incomplete Identifiers", "Missing Disposition", "Incorrect Status", "Incomplete Verification", "Duplicate Record", "Reportability Review Required"];

function text(value: unknown) { return String(value ?? ""); }
function tone(value: unknown) {
  const status = text(value);
  if (status === "Approved" || status === "Released") return "green";
  if (status.includes("Compliance")) return "red";
  if (status.includes("Research")) return "amber";
  return "purple";
}

export default function QualityReviewWorkspace({ initialReviews, requestedQa, role }: { initialReviews: DataRow[]; requestedQa: string; role: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All priorities");
  const [reviewer, setReviewer] = useState("All reviewers");
  const [status, setStatus] = useState("Open review statuses");
  const [selectedQa, setSelectedQa] = useState(() => initialReviews.some((review) => text(review.qa_id) === requestedQa) ? requestedQa : text(initialReviews[0]?.qa_id));
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [baseline, setBaseline] = useState<Record<string, { completed: boolean; note: string }>>({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [decision, setDecision] = useState("Approve");
  const [returnReason, setReturnReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const canEditChecklist = role === "Administrator" || role === "Operations Specialist" || role === "QA Reviewer";
  const canDecide = role === "Administrator" || role === "QA Reviewer";
  const reviewers = useMemo(() => [...new Set(initialReviews.map((review) => text(review.reviewer)).filter(Boolean))].sort(), [initialReviews]);
  const statuses = useMemo(() => [...new Set(initialReviews.map((review) => text(review.status)).filter(Boolean))].sort(), [initialReviews]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialReviews.filter((review) => {
      const haystack = [review.qa_id, review.order_id, review.candidate, review.client, review.position, review.package].map(text).join(" ").toLowerCase();
      const statusMatch = status === "All statuses" || status === "Open review statuses" && !["Approved", "Released"].includes(text(review.status)) || text(review.status) === status;
      return (!needle || haystack.includes(needle)) && (priority === "All priorities" || text(review.priority) === priority) && (reviewer === "All reviewers" || text(review.reviewer) === reviewer) && statusMatch;
    });
  }, [initialReviews, priority, query, reviewer, status]);
  const selected = initialReviews.find((review) => text(review.qa_id) === selectedQa) || null;
  const checklistDirty = Boolean(items.length && items.some((item) => {
    const original = baseline[item.key];
    return !original || original.completed !== item.completed || original.note !== item.note;
  }));
  const completeCount = items.filter((item) => item.completed).length;
  const allComplete = Boolean(items.length && completeCount === items.length);

  useEffect(() => {
    if (!selectedQa) { setItems([]); setBaseline({}); return; }
    const controller = new AbortController();
    setLoadingChecklist(true);
    setError("");
    fetch(`/api/clearpath/qa/${selectedQa}/checklist`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Unable to load QA checklist"); return body; })
      .then((body) => {
        const next = Array.isArray(body.items) ? body.items.map((item: ChecklistItem) => ({ ...item, completed: Boolean(item.completed), note: item.note || "" })) : [];
        setItems(next);
        setBaseline(Object.fromEntries(next.map(({ key, completed, note }: ChecklistItem) => [key, { completed, note }])));
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load QA checklist"); })
      .finally(() => { if (!controller.signal.aborted) setLoadingChecklist(false); });
    return () => controller.abort();
  }, [selectedQa]);

  useEffect(() => {
    if (!requestedQa || window.innerWidth > 700) return;
    const timer = window.setTimeout(() => {
      document.querySelector(".qa-detail-panel")?.scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requestedQa]);

  function selectReview(qaId: string) {
    setSelectedQa(qaId);
    setDecision("Approve");
    setReturnReason("");
    setDecisionNote("");
    setError("");
    router.replace(`/app/quality-review?qa=${encodeURIComponent(qaId)}`, { scroll: false });
    if (window.innerWidth <= 700) {
      window.setTimeout(() => {
        document.querySelector(".qa-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  function updateItem(index: number, changes: Partial<ChecklistItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  async function saveChecklist() {
    if (!selectedQa || !checklistDirty) return;
    setSavingChecklist(true);
    setError("");
    try {
      const response = await fetch(`/api/clearpath/qa/${selectedQa}/checklist`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items.map(({ key, completed, note }) => ({ key, completed, note })) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save QA checklist");
      const saved = Array.isArray(body.items) ? body.items.map((item: ChecklistItem) => ({ ...item, completed: Boolean(item.completed), note: item.note || "" })) : items;
      setItems(saved);
      setBaseline(Object.fromEntries(saved.map(({ key, completed, note }: ChecklistItem) => [key, { completed, note }])));
      setToast(`QA checklist saved for ${selectedQa}.`);
      window.setTimeout(() => setToast(""), 3500);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save QA checklist"); }
    finally { setSavingChecklist(false); }
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQa) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = { decision, returnReason: decision === "Return to Operations" ? returnReason : undefined, note: decisionNote };
      const response = await fetch(`/api/clearpath/qa/${selectedQa}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save QA decision");
      setToast(`${decision} saved for ${selectedQa}.`);
      window.setTimeout(() => setToast(""), 3500);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save QA decision"); }
    finally { setSubmitting(false); }
  }

  const decisionNeedsNote = decision === "Return to Operations" || decision === "Request Additional Research" || decision === "Escalate to Compliance";
  const approvalBlocked = (decision === "Approve" || decision === "Release Report") && (!allComplete || checklistDirty);

  return (
    <div className="page quality-workspace">
      <PageHead eyebrow="QUALITY CONTROL" title="Quality Review" subtitle="Select the exact QA record, preserve checklist evidence, and submit an authorized decision." />

      <section className="qa-summary-strip" aria-label="Quality review summary">
        <article><span>Open reviews</span><strong>{initialReviews.filter((review) => !["Approved", "Released"].includes(text(review.status))).length}</strong></article>
        <article><span>High priority</span><strong>{initialReviews.filter((review) => review.priority === "High" && !["Approved", "Released"].includes(text(review.status))).length}</strong></article>
        <article><span>Approved</span><strong>{initialReviews.filter((review) => review.status === "Approved").length}</strong></article>
        <article><span>Released</span><strong>{initialReviews.filter((review) => review.status === "Released").length}</strong></article>
      </section>

      <section className="qa-filter-panel" aria-label="Quality review filters">
        <label className="qa-search"><span>Search reports</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="QA, order, candidate, or client" /></label>
        <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option>All priorities</option><option>High</option><option>Normal</option></select></label>
        <label><span>Reviewer</span><select value={reviewer} onChange={(event) => setReviewer(event.target.value)}><option>All reviewers</option>{reviewers.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Open review statuses</option><option>All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      </section>

      <div className="qa-workbench">
        <section className="card qa-review-list" aria-label="QA records">
          <div className="qa-review-list-head"><div><strong>{filtered.length} QA {filtered.length === 1 ? "record" : "records"}</strong><span>Select a record to inspect its saved checklist.</span></div><small>{role}</small></div>
          {filtered.length ? <div className="qa-records">{filtered.map((review) => {
            const qaId = text(review.qa_id);
            const completed = Number(review.checklist_complete || 0);
            const total = Number(review.checklist_total || 0);
            return <button type="button" className={`qa-record ${qaId === selectedQa ? "selected" : ""}`} aria-pressed={qaId === selectedQa} onClick={() => selectReview(qaId)} key={qaId}>
              <div><strong>{qaId}</strong><Badge tone={review.priority === "High" ? "red" : "gray"}>{text(review.priority).toUpperCase()}</Badge></div>
              <h2>{text(review.candidate)}</h2><p>{text(review.order_id)} · {text(review.client)}</p>
              <div className="qa-record-meta"><span><small>Checklist</small><b>{completed}/{total}</b></span><span><small>Issues</small><b>{text(review.issue_count)}</b></span><span><small>Age</small><b>{text(review.age)}d</b></span></div>
              <div className="qa-record-foot"><Badge tone={tone(review.status)}>{text(review.status)}</Badge><span>{text(review.reviewer)}</span></div>
            </button>;
          })}</div> : <div className="qa-no-results"><h2>No QA records match</h2><p>Change the active filters to continue.</p></div>}
        </section>

        <section className="card qa-detail-panel" aria-label="Selected quality review">
          {selected ? <>
            <div className="qa-detail-head"><div><p className="kicker">SELECTED QA RECORD</p><h2>{text(selected.qa_id)} · {text(selected.candidate)}</h2><p>{text(selected.client)} · {text(selected.package)} · {text(selected.position)}</p></div><Badge tone={tone(selected.status)}>{text(selected.status)}</Badge></div>
            <div className="qa-context-grid"><span><small>Underlying order</small><Link href={`/app/orders/${text(selected.order_id)}`}>{text(selected.order_id)} →</Link></span><span><small>Target completion</small><strong>{text(selected.target_date)}</strong></span><span><small>Reviewer</small><strong>{text(selected.reviewer)}</strong></span><span><small>Reported issues</small><strong>{text(selected.issue_count)}</strong></span></div>

            <div className="qa-checklist-head"><div><h3>QA checklist</h3><p>Evidence is saved against {text(selected.qa_id)}, not a generic selected report.</p></div><span><strong>{completeCount}</strong> of {items.length} complete</span></div>
            <div className="qa-progress" aria-label={`${completeCount} of ${items.length} checklist items complete`}><i style={{ width: `${items.length ? completeCount / items.length * 100 : 0}%` }} /></div>
            {loadingChecklist ? <div className="qa-loading">Loading saved checklist…</div> : <div className="qa-checklist-items">{items.map((item, index) => <div className={`qa-checklist-item ${item.completed ? "complete" : ""}`} key={item.key}>
              <label><input type="checkbox" checked={item.completed} disabled={!canEditChecklist} onChange={(event) => updateItem(index, { completed: event.target.checked })} /><span><strong>{item.label}</strong><small>{item.updatedBy ? `Last updated by ${item.updatedBy}${item.updatedAt ? ` · ${item.updatedAt}` : ""}` : "Not yet verified"}</small></span></label>
              <input aria-label={`Evidence note for ${item.label}`} disabled={!canEditChecklist} value={item.note} onChange={(event) => updateItem(index, { note: event.target.value })} placeholder="Optional evidence note" />
            </div>)}</div>}
            <div className="qa-checklist-save"><span>{checklistDirty ? "Unsaved checklist changes" : allComplete ? "Checklist complete and saved" : "Checklist progress is saved"}</span><button type="button" className="btn primary" disabled={!canEditChecklist || !checklistDirty || savingChecklist} onClick={saveChecklist}>{savingChecklist ? "Saving…" : "Save QA Checklist"}</button></div>

            <form className="qa-decision-form" onSubmit={submitDecision}>
              <div><h3>QA decision</h3><p>Only an Administrator or QA Reviewer can submit a final decision.</p></div>
              <label>Decision<select disabled={!canDecide} value={decision} onChange={(event) => { setDecision(event.target.value); setReturnReason(""); }}><option>Approve</option><option>Return to Operations</option><option>Request Additional Research</option><option>Escalate to Compliance</option><option>Release Report</option></select></label>
              {decision === "Return to Operations" && <label>Return reason<select required disabled={!canDecide} value={returnReason} onChange={(event) => setReturnReason(event.target.value)}><option value="">Select a return reason</option>{returnReasons.map((value) => <option key={value}>{value}</option>)}</select></label>}
              <label>Decision note<textarea required={decisionNeedsNote} disabled={!canDecide} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder={decisionNeedsNote ? "Required: explain the work needed or compliance concern." : "Optional decision context."} /></label>
              {approvalBlocked && <p className="qa-decision-warning">Complete and save every checklist item before approving or releasing this report.</p>}
              {!canDecide && <p className="qa-decision-warning">Your {role || "current"} role can update checklist evidence but cannot submit QA decisions.</p>}
              <button type="submit" className="btn primary" disabled={!canDecide || submitting || approvalBlocked}>{submitting ? "Submitting…" : "Submit QA Decision"}</button>
            </form>
            {error && <p className="form-error qa-error" role="alert">{error}</p>}
          </> : <div className="qa-empty-selection"><span aria-hidden="true">✓</span><h2>Select a QA record</h2><p>Choose a report from the list to load its exact saved checklist and decision history.</p></div>}
        </section>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
