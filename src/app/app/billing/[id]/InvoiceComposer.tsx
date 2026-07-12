"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type LineItem = { description: string; amount: string };
type Invoice = {
  id?: number;
  invoiceNumber?: string;
  invoice_id?: string;
  invoiceId?: string;
  created_at?: string;
  createdAt?: string;
  createdBy?: string;
  due_date?: string;
  dueDate?: string;
  status?: string;
  note?: string;
  total?: number;
  lineItems?: Array<{ description: string; amount: number }>;
};
export default function InvoiceComposer({
  billingId,
  client,
  orderId,
  defaultDescription,
  defaultAmount,
}: {
  billingId: string;
  client: string;
  orderId: string;
  defaultDescription: string;
  defaultAmount: number;
}) {
  const [dueDate, setDueDate] = useState(() =>
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    ),
    [note, setNote] = useState(""),
    [items, setItems] = useState<LineItem[]>([
      { description: defaultDescription, amount: defaultAmount.toFixed(2) },
    ]),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const total = useMemo(
    () => items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0),
    [items],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clearpath/billing/${billingId}/invoice`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(
          Array.isArray(data)
            ? data
            : Array.isArray(data.invoices)
              ? data.invoices
              : data.invoice
                ? [data.invoice]
                : [],
        );
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [billingId]);
  useEffect(() => {
    load();
  }, [load]);
  function update(index: number, key: keyof LineItem, value: string) {
    setItems((current) =>
      current.map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const normalized = items.map((x) => ({
      description: x.description.trim(),
      amount: Number(x.amount),
    }));
    if (!dueDate) return setError("Choose an invoice due date.");
    if (normalized.some((x) => !x.description))
      return setError("Every line item needs a description.");
    if (normalized.some((x) => !Number.isFinite(x.amount) || x.amount <= 0))
      return setError("Every line item amount must be greater than $0.");
    setSaving(true);
    try {
      const res = await fetch(`/api/clearpath/billing/${billingId}/invoice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dueDate,
          note: note.trim(),
          lineItems: normalized,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Invoice could not be created.");
      setSuccess(
        `Invoice ${data.invoice?.invoiceNumber || data.invoice?.invoice_id || data.invoice?.invoiceId || data.invoice_id || "created"} was saved.`,
      );
      setNote("");
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Invoice could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <aside className="billing-invoice-column">
      <section className="card invoice-history">
        <div className="card-head">
          <div>
            <h2>Existing invoices</h2>
            <p>Persisted invoices for this billing exception</p>
          </div>
        </div>
        {loading ? (
          <p className="invoice-empty">Loading invoices…</p>
        ) : invoices.length ? (
          <div className="invoice-list">
            {invoices.map((x, i) => (
              <article key={String(x.id || x.invoiceNumber || x.invoice_id || i)}>
                <div>
                  <b>{x.invoiceNumber || x.invoice_id || x.invoiceId || `Invoice ${i + 1}`}</b>
                  <span className="badge green">{x.status || "Created"}</span>
                </div>
                <p>
                  Due {x.due_date || x.dueDate || "—"}
                  {x.createdBy ? ` · Created by ${x.createdBy}` : ""}
                </p>
                <strong>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(
                    Number(
                      x.total ||
                        x.lineItems?.reduce(
                          (s, l) => s + Number(l.amount),
                          0,
                        ) ||
                        0,
                    ),
                  )}
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="invoice-empty">No invoices created yet.</p>
        )}
      </section>
      <form className="card invoice-composer" onSubmit={submit}>
        <div className="card-head">
          <div>
            <h2>Create client invoice</h2>
            <p>
              {client} · {orderId}
            </p>
          </div>
        </div>
        <div className="invoice-form-body">
          <label>
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </label>
          <fieldset>
            <legend>Line items</legend>
            {items.map((x, i) => (
              <div className="invoice-line" key={i}>
                <label>
                  Description
                  <input
                    value={x.description}
                    onChange={(e) => update(i, "description", e.target.value)}
                    placeholder="Screening service"
                  />
                </label>
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={x.amount}
                    onChange={(e) => update(i, "amount", e.target.value)}
                  />
                </label>
                {items.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove line item ${i + 1}`}
                    onClick={() =>
                      setItems((current) => current.filter((_, n) => n !== i))
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="add-line"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { description: "", amount: "" },
                ])
              }
            >
              + Add line item
            </button>
          </fieldset>
          <label>
            Invoice note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note shown with this invoice"
            />
          </label>
          <div className="invoice-total">
            <span>Invoice total</span>
            <b>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(total)}
            </b>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="form-success" role="status">
              ✓ {success}
            </p>
          )}
          <button className="btn primary wide" type="submit" disabled={saving}>
            {saving ? "Creating invoice…" : "Create invoice"}
          </button>
        </div>
      </form>
    </aside>
  );
}
