import Link from "next/link";
import { rows } from "@/lib/clearpath";
import { PageHead } from "@/components/Portal";

export default function Reports() {
  const reports = rows("SELECT * FROM cp_reports ORDER BY id DESC");
  const completed = Number(rows("SELECT COUNT(*) count FROM cp_orders WHERE status='Complete'")[0]?.count || 0);
  return (
    <div className="page">
      <PageHead
        eyebrow="REPORTING"
        title="Reports"
        subtitle="Candidate screening reports and manually prepared operations briefs."
        actions={<Link href="/app/reports/operations" className="btn primary">+ Create Operations Report</Link>}
      />
      <div className="report-type-grid">
        <section className="card">
          <span>▣</span>
          <h2>Candidate Screening Reports</h2>
          <p>Review completed searches, results, discrepancies, notices, and report versions.</p>
          <b>{completed} completed reports</b>
          <Link className="btn outline" href="/app/queues/reports-ready-to-release">Browse Reports →</Link>
        </section>
        <section className="card">
          <span>▥</span>
          <h2>Operations Reports</h2>
          <p>Saved daily operational summaries prepared from dashboard and queue data.</p>
          <b>{reports.length} saved reports</b>
          <Link className="btn outline" href="/app/reports/operations">Create Report →</Link>
        </section>
      </div>
      {reports.length > 0 && (
        <section className="card saved-reports">
          <h2>Saved Operations Reports</h2>
          {reports.map((report) => (
            <details key={String(report.id)}>
              <summary><span>▥</span><b>{report.title}</b><small>{report.created_at} · {report.created_by}</small></summary>
              <p>{report.summary}</p>
              {report.highlights && <p><b>Highlights:</b> {report.highlights}</p>}
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
