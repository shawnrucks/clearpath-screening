"use client";

import {FormEvent, useCallback, useEffect, useId, useRef, useState} from "react";

type VendorMessage = {
  id: number | string;
  subject: string;
  body: string;
  search_id?: string | null;
  searchId?: string | null;
  follow_up_date?: string | null;
  followUpDate?: string | null;
  created_at?: string;
  createdAt?: string;
  created_by?: string;
  createdBy?: string;
  sentAt?: string;
  sentBy?: string;
};

export default function VendorContact({vendorId, vendorName}: {vendorId: number; vendorName: string}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<VendorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const titleId = useId();
  const statusId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clearpath/vendors/${vendorId}/messages`, {cache: "no-store"});
      if (!response.ok) throw new Error("Message history could not be loaded.");
      const result = await response.json() as VendorMessage[] | {messages?: VendorMessage[]};
      setMessages(Array.isArray(result) ? result : result.messages ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useEffect(() => {
    if (!open) return;
    subjectRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, sending]);

  function close() {
    if (sending) return;
    setOpen(false);
    setError("");
    triggerRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setError("");
    setSuccess("");
    const form = new FormData(formElement);
    const payload = {
      subject: String(form.get("subject") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      searchId: String(form.get("searchId") ?? "").trim(),
      followUpDate: String(form.get("followUpDate") ?? ""),
    };
    try {
      const response = await fetch(`/api/clearpath/vendors/${vendorId}/messages`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as {error?: string} | null;
        throw new Error(result?.error || "The vendor message could not be saved.");
      }
      formElement.reset();
      setOpen(false);
      setSuccess(`Message sent to ${vendorName} and recorded in ClearPath.`);
      await loadMessages();
      triggerRef.current?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The vendor message could not be saved.");
    } finally {
      setSending(false);
    }
  }

  return <div className="vendor-communications">
    <button ref={triggerRef} type="button" className="btn outline wide" onClick={() => { setError(""); setSuccess(""); setOpen(true); }}>Contact Vendor</button>
    <div className="vendor-history" aria-live="polite">
      <div className="vendor-history-head"><b>Message history</b><button type="button" onClick={() => void loadMessages()} disabled={loading}>Refresh</button></div>
      {loading ? <p>Loading messages…</p> : messages.length ? <ol>
        {messages.map(message => <li key={String(message.id)}>
          <div><b>{message.subject}</b><small>{message.sentAt ?? message.created_at ?? message.createdAt ?? "Saved"}{(message.sentBy ?? message.created_by ?? message.createdBy) ? ` · ${message.sentBy ?? message.created_by ?? message.createdBy}` : ""}</small></div>
          <p>{message.body}</p>
          {(message.search_id ?? message.searchId) && <span>Search: {message.search_id ?? message.searchId}</span>}
          {(message.follow_up_date ?? message.followUpDate) && <span>Follow-up: {message.follow_up_date ?? message.followUpDate}</span>}
        </li>)}
      </ol> : <p>No messages recorded yet.</p>}
    </div>
    {success && <p className="vendor-success" role="status">✓ {success}</p>}
    {!open && error && <p className="form-error" role="alert">{error}</p>}
    {open && <div className="vendor-compose-bg" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="vendor-compose" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={statusId}>
        <div className="vendor-compose-head"><div><p className="kicker">VENDOR COMMUNICATION</p><h2 id={titleId}>Contact {vendorName}</h2></div><button type="button" aria-label="Close vendor message" onClick={close} disabled={sending}>×</button></div>
        <form onSubmit={submit}>
          <label>Subject<input ref={subjectRef} name="subject" required maxLength={160} autoComplete="off" /></label>
          <label>Message<textarea name="body" required maxLength={5000} rows={7} placeholder="Document the request, expected response, and operational context." /></label>
          <div className="vendor-compose-two">
            <label>Search ID <span>(optional)</span><input name="searchId" maxLength={40} pattern="SRC-[0-9]+" title="Use a search ID such as SRC-5001" placeholder="SRC-5001" autoComplete="off" /></label>
            <label>Follow-up date <span>(optional)</span><input name="followUpDate" type="date" /></label>
          </div>
          <div id={statusId} aria-live="assertive">{error && <p className="form-error" role="alert">{error}</p>}</div>
          <div className="modal-actions"><button type="button" className="btn outline" onClick={close} disabled={sending}>Cancel</button><button className="btn primary" disabled={sending}>{sending ? "Sending…" : "Send Message"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
