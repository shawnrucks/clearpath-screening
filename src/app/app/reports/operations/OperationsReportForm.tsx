"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead } from "@/components/Portal";
import styles from "./operations.module.css";

type Metric = { label: string; value: number };

export default function OperationsReportForm({
  metrics,
  preparedBy,
}: {
  metrics: Metric[];
  preparedBy: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const displayDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date("2026-07-12T12:00:00"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/clearpath/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "report",
          title: form.get("title"),
          summary: form.get("summary"),
          highlights: form.get("highlights"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The report could not be saved.");
      router.push("/app/reports");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be saved.");
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="EXECUTIVE REPORTING"
        title="Create Operations Report"
        subtitle="Review live operational data, enter your analysis, and save an auditable report."
      />
      <form className="operations-form" onSubmit={submit}>
        <section className="card">
          <div className="report-snapshot-head">
            <div>
              <h2>Current Operational Snapshot</h2>
              <p>Live counts from the shared ClearPath database.</p>
            </div>
            <span className="queue-live-indicator"><i aria-hidden="true" /> Live operational data</span>
          </div>
          <div className={`snapshot-metrics ${styles.snapshotMetrics}`}>
            {metrics.map((metric) => (
              <div key={metric.label}>
                <b>{metric.value}</b>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
          <p className="info-note">Use these counts as evidence, then document the workload, pressure points, owners, and next actions below.</p>
        </section>
        <section className="card form-card">
          <label>
            Report title
            <input name="title" defaultValue={`Morning Operations Report — ${displayDate}`} required maxLength={160} />
          </label>
          <label>
            Executive summary
            <textarea name="summary" rows={6} maxLength={5000} placeholder="Summarize workload, aging, completions, and operational pressure..." required />
          </label>
          <label>
            High-priority issues and next actions
            <textarea name="highlights" rows={7} maxLength={5000} placeholder="Document urgent items, owners, next actions, and timing..." required />
          </label>
          <div className="form-two">
            <label>
              Reporting period
              <input value={`Today — ${displayDate}`} readOnly />
            </label>
            <label style={{ gridColumn: "auto" }}>
              Prepared by
              <input value={preparedBy} readOnly />
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn outline" onClick={() => router.back()} disabled={saving}>Cancel</button>
            <button className="btn primary" disabled={saving}>{saving ? "Saving Report…" : "Save Operations Report"}</button>
          </div>
        </section>
      </form>
    </div>
  );
}
