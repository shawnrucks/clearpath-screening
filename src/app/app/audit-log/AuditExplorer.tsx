"use client";

import {useMemo, useState} from "react";
import {Badge} from "@/components/Portal";

type AuditRow=Record<string,string|number|null>;

function asText(value:unknown){return String(value??"");}
function snapshot(value:unknown){
  const raw=asText(value);
  if(!raw)return "—";
  try{
    const parsed=JSON.parse(raw) as Record<string,unknown>;
    const record=parsed.record&&typeof parsed.record==="object"?parsed.record as Record<string,unknown>:parsed;
    const entries=Object.entries(record).filter(([,entry])=>entry!==null&&entry!=="").slice(0,3);
    return entries.map(([key,entry])=>`${key.replaceAll("_"," ")}: ${asText(entry)}`).join(" · ")||"Recorded change";
  }catch{return raw.length>140?`${raw.slice(0,137)}…`:raw;}
}

export default function AuditExplorer({initialRows}:{initialRows:AuditRow[]}){
  const [query,setQuery]=useState(""),[user,setUser]=useState("All users"),[action,setAction]=useState("All actions"),[entity,setEntity]=useState("All entity types"),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const users=useMemo(()=>Array.from(new Set(initialRows.map(row=>asText(row.user)))).sort(),[initialRows]);
  const actions=useMemo(()=>Array.from(new Set(initialRows.map(row=>asText(row.action)))).sort(),[initialRows]);
  const entities=useMemo(()=>Array.from(new Set(initialRows.map(row=>asText(row.entity_type)))).sort(),[initialRows]);
  const filtered=useMemo(()=>initialRows.filter(row=>{
    const term=query.trim().toLowerCase();
    const searchable=[row.user,row.role,row.action,row.entity_type,row.entity_id,row.note].map(asText).join(" ").toLowerCase();
    const date=asText(row.ts).slice(0,10);
    return (!term||searchable.includes(term))&&(user==="All users"||row.user===user)&&(action==="All actions"||row.action===action)&&(entity==="All entity types"||row.entity_type===entity)&&(!from||date>=from)&&(!to||date<=to);
  }),[action,entity,from,initialRows,query,to,user]);
  function exportCsv(){
    const columns=["ts","user","role","action","entity_type","entity_id","previous_value","new_value","note","source","session_id"];
    const quote=(value:unknown)=>`"${asText(value).replaceAll('"','""')}"`;
    const csv=[columns.map(quote).join(","),...filtered.map(row=>columns.map(column=>quote(row[column])).join(","))].join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),anchor=document.createElement("a");anchor.href=url;anchor.download="clearpath-audit-log.csv";anchor.click();URL.revokeObjectURL(url);
  }
  const filteredActive=query||user!=="All users"||action!=="All actions"||entity!=="All entity types"||from||to;
  return <>
    <div className="filters audit-filters">
      <div className="audit-primary-filters">
        <label className="filter-search"><span aria-hidden="true">⌕</span><input aria-label="Search audit events" placeholder="Search events, people, or records…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <label><span className="sr-only">User</span><select aria-label="Filter by user" value={user} onChange={event=>setUser(event.target.value)}><option>All users</option>{users.map(value=><option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Action</span><select aria-label="Filter by action" value={action} onChange={event=>setAction(event.target.value)}><option>All actions</option>{actions.map(value=><option key={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Entity type</span><select aria-label="Filter by entity type" value={entity} onChange={event=>setEntity(event.target.value)}><option>All entity types</option>{entities.map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="audit-date-filters">
        <label className="date-filter">From<input aria-label="Audit start date" type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
        <label className="date-filter">To<input aria-label="Audit end date" type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
        <button type="button" className="btn outline" disabled={!filteredActive} onClick={()=>{setQuery("");setUser("All users");setAction("All actions");setEntity("All entity types");setFrom("");setTo("");}}>Clear filters</button>
      </div>
    </div>
    <section className="card table-card audit-card"><div className="table-summary"><div><b>{filtered.length} events</b><span>Server-side evidence with actor and session attribution</span></div><button type="button" className="btn outline" onClick={exportCsv} disabled={!filtered.length}>Export filtered CSV</button></div><table><thead><tr><th>Timestamp</th><th>User / Role</th><th>Action</th><th>Entity</th><th>Change summary</th><th>Note</th><th>Source / Session</th></tr></thead><tbody>{filtered.map(row=><tr key={asText(row.id)}><td>{row.ts}</td><td><b>{row.user}</b><small>{row.role}</small></td><td><Badge tone="blue">{row.action}</Badge></td><td><b>{row.entity_type}</b><small className="link-blue">{row.entity_id}</small></td><td className="audit-change"><span>{snapshot(row.new_value)}</span><details><summary>Evidence</summary><pre>{JSON.stringify({previous:row.previous_value,new:row.new_value},null,2)}</pre></details></td><td>{row.note||"—"}</td><td><b>{row.source}</b><small>{row.session_id}</small></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty-state"><b>No matching audit events</b><p>Clear or broaden the filters to see more evidence.</p></div>}</section>
  </>;
}
