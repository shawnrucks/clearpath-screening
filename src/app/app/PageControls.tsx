"use client";

import {useRouter} from "next/navigation";
import type {ReactNode} from "react";

export function UnavailableButton({children, className = "", reason}: {children: ReactNode; className?: string; reason: string}) {
  return <button type="button" className={className} disabled title={reason}>{children}</button>;
}

export function LogoutButton({children = "Sign out", className = ""}: {children?: ReactNode; className?: string}) {
  const router = useRouter();
  async function logout() {
    const response = await fetch("/api/clearpath/logout", {method: "POST"});
    if (response.ok) router.replace("/login");
  }
  return <button type="button" className={className} onClick={logout}>{children}</button>;
}

export function ExportCsvButton({rows, filename, className = "btn outline"}: {rows: Record<string, unknown>[]; filename: string; className?: string}) {
  function download() {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(quote).join(","), ...rows.map(row => columns.map(column => quote(row[column])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return <button type="button" className={className} onClick={download} disabled={!rows.length} title={rows.length ? `Download ${rows.length} rows as CSV` : "No records to export"}>Export</button>;
}
