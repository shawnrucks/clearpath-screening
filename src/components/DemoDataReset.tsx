"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";

type Variant = "button" | "header";
type ResetSummary = {orders: number; searches: number; users: number; seedVersion: string};

const labels: Record<Variant, string> = {
  button: "↻ Reseed demo data…",
  header: "Reseed demo data",
};

export default function DemoDataReset({
  variant = "button",
}: {
  variant?: Variant;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (busy) dialogRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!summary) return;
    const timer = window.setTimeout(() => setSummary(null), 6000);
    return () => window.clearTimeout(timer);
  }, [summary]);

  function showDialog() {
    setError("");
    setAcknowledged(false);
    setOpen(true);
  }

  function closeDialog() {
    if (busy) return;
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        "input:not([disabled]), button:not([disabled])",
      ),
    );
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function reset() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({confirmation: "RESTORE_CLEARPATH_DEMO"}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Demo data restoration is not available for this account."
            : response.status === 401
              ? "Your session expired. Sign in again before reseeding the demo."
            : response.status === 409
              ? "Another reseed is already running. Wait a moment and try again."
              : typeof body.error === "string"
                ? body.error
                : "The demo data could not be restored. Please try again.",
        );
      }
      const counts = body.counts;
      if (
        body.ok !== true ||
        !counts ||
        !Number.isInteger(counts.orders) ||
        !Number.isInteger(counts.searches) ||
        !Number.isInteger(counts.users) ||
        counts.orders !== 50 ||
        counts.searches !== 150 ||
        counts.users !== 8 ||
        typeof body.seedVersion !== "string" ||
        !body.seedVersion.trim()
      ) {
        throw new Error("The server did not confirm a complete seed dataset. Please try again.");
      }
      setOpen(false);
      setSummary({
        orders: counts.orders,
        searches: counts.searches,
        users: counts.users,
        seedVersion: body.seedVersion,
      });
      window.setTimeout(() => triggerRef.current?.focus(), 0);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The demo data could not be restored.");
    } finally {
      setBusy(false);
    }
  }

  const triggerClass =
    variant === "button"
      ? "btn danger"
      : "demo-reset-header";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={variant === "header" ? labels.header : undefined}
        className={triggerClass}
        onClick={showDialog}
      >
        {variant === "header" ? (
          <><span aria-hidden="true">↻</span><span>{labels.header}</span></>
        ) : labels.button}
      </button>
      {open && (
        <div className="modal-bg" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <div
            ref={dialogRef}
            className="modal reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-description"
            aria-busy={busy}
            onKeyDown={handleDialogKeyDown}
            tabIndex={-1}
          >
            <div className="warning-icon" aria-hidden="true">↻</div>
            <p className="kicker">SHARED DEMO ENVIRONMENT</p>
            <h2 id="reset-title">Reseed the shared demo environment?</h2>
            <p id="reset-description">
              Restore the original ClearPath dataset with 50 orders, 150 searches, and eight
              demo users. All orders, messages, invoices, reports, and workflow changes made
              during this demo will be replaced.
            </p>
            <div className="reset-impact" role="note">
              Your login will stay active. This cannot be undone.
            </div>
            <label className="reset-confirmation">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={busy}
              />
              <span>I understand that all changes in the shared demo will be replaced.</span>
            </label>
            {busy && <p className="resetting" role="status">Reseeding the complete demo dataset…</p>}
            {error && <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</p>}
            <div className="modal-actions">
              <button ref={cancelRef} type="button" className="btn outline" onClick={closeDialog} disabled={busy}>
                Keep Current Data
              </button>
              <button type="button" className="btn danger" onClick={reset} disabled={busy || !acknowledged}>
                {busy ? "Reseeding…" : "Reseed Demo Data"}
              </button>
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="toast reset-toast" role="status">
          <b>✓ Demo data restored</b>
          <span>{summary.orders} orders · {summary.searches} searches · {summary.users} users · seed {summary.seedVersion}</span>
        </div>
      )}
    </>
  );
}
