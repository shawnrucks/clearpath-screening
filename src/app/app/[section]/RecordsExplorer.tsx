"use client";

import Link from "next/link";
import {useMemo, useState} from "react";
import {Badge} from "@/components/Portal";

export type ExplorerRecord = {
  id: string;
  href: string;
  values: Record<string, string | number>;
};

export default function RecordsExplorer({records, noun}: {records: ExplorerRecord[]; noun: string}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const columns = Object.keys(records[0]?.values ?? {});
  const statuses = useMemo(() => Array.from(new Set(records.map(record => String(record.values.Status ?? "")).filter(Boolean))).sort(), [records]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter(record => {
      const matchesText = !term || Object.values(record.values).some(value => String(value).toLowerCase().includes(term));
      const matchesStatus = status === "All statuses" || String(record.values.Status ?? "") === status;
      return matchesText && matchesStatus;
    });
  }, [query, records, status]);

  return <>
    <div className="filters record-filters">
      <label className="filter-search"><span aria-hidden="true">⌕</span><input aria-label={`Search ${noun.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${noun.toLowerCase()}…`}/></label>
      {statuses.length > 0 && <label><span className="sr-only">Status</span><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option>All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>}
      <span className="filter-count">{filtered.length} of {records.length} records</span>
    </div>
    <section className="card table-card">
      <div className="table-summary"><b>{filtered.length} {noun.toLowerCase()}</b><span>Searchable operational records</span></div>
      <table>
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}<th><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{filtered.map(record => <tr key={record.id}>{columns.map((column, index) => {
          const value = record.values[column];
          return <td key={column}>{index === 0 ? <Link className="link-blue" href={record.href}><b>{value}</b></Link> : column === "Status" ? <Badge tone={String(value).includes("Complete") || value === "Active" ? "green" : String(value).includes("Possible") ? "red" : "blue"}>{value}</Badge> : value === "" ? "—" : value}</td>;
        })}<td><Link className="table-action" href={record.href}>Open →</Link></td></tr>)}</tbody>
      </table>
      {!filtered.length && <div className="empty-state"><b>No matching records</b><p>Try a different name, ID, status, client, or jurisdiction.</p></div>}
    </section>
  </>;
}
