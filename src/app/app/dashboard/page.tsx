import Link from "next/link";
import {Badge, PageHead} from "@/components/Portal";
import {rows} from "@/lib/clearpath";

function count(sql:string,...args:unknown[]) {
  return Number(rows(sql,...args)[0]?.count ?? 0);
}

export default function Dashboard() {
  const latestOrderDate=String(rows("SELECT MAX(order_date) latest FROM cp_orders")[0]?.latest ?? "2026-07-12");
  const metrics=[
    ["New Orders",count("SELECT COUNT(*) count FROM cp_orders WHERE order_date=?",latestOrderDate),`Received ${latestOrderDate}`,"blue","/app/queues/new-order-review","▥"],
    ["Candidate Action Required",count("SELECT COUNT(*) count FROM cp_orders WHERE status='Candidate Action Required'"),"Missing information or authorization","amber","/app/queues/candidate-missing-information","♙"],
    ["Searches In Progress",count("SELECT COUNT(*) count FROM cp_searches WHERE status IN ('Assigned','In Progress','Awaiting Vendor')"),"Active fulfillment work","blue","/app/searches","⌕"],
    ["Overdue Searches",count("SELECT COUNT(*) count FROM cp_searches WHERE due_date<'2026-07-12' AND status NOT IN ('Completed','Cancelled')"),"Past expected completion","red","/app/queues/overdue-searches","!"],
    ["QA Review Required",count("SELECT COUNT(*) count FROM cp_qa WHERE status IN ('Pending Review','Additional Research','Compliance Review')"),"Procedural review pending","purple","/app/quality-review","✓"],
    ["Reports Ready to Release",count("SELECT COUNT(*) count FROM cp_qa WHERE status='Approved'"),"Approved reports awaiting release","green","/app/queues/reports-ready-to-release","▣"],
    ["Billing Exceptions",count("SELECT COUNT(*) count FROM cp_billing WHERE status NOT IN ('Resolved','Invoiced')"),"Cost or pricing reconciliation","amber","/app/billing","$"],
    ["Open Disputes",(()=>{try{return count("SELECT COUNT(*) count FROM cp_disputes WHERE status!='Resolved'")}catch{return 0}})(),"Human review required","red","/app/queues","⚑"],
  ] as const;
  const aging=[
    ["Less than 24 hours",count("SELECT COUNT(*) count FROM cp_orders WHERE aging<1"),"#3b82f6"],
    ["1–2 days",count("SELECT COUNT(*) count FROM cp_orders WHERE aging BETWEEN 1 AND 2"),"#6098e8"],
    ["3–5 days",count("SELECT COUNT(*) count FROM cp_orders WHERE aging BETWEEN 3 AND 5"),"#f59e0b"],
    ["More than 5 days",count("SELECT COUNT(*) count FROM cp_orders WHERE aging>5"),"#dc5b5b"],
  ] as const;
  const totalAging=aging.reduce((sum,item)=>sum+Number(item[1]),0);
  const oldAging=Number(aging[2][1])+Number(aging[3][1]);
  const activity=[
    [count("SELECT COUNT(*) count FROM cp_orders WHERE order_date=?",latestOrderDate),"Orders received","▥"],
    [count("SELECT COUNT(*) count FROM cp_searches WHERE status='Completed'"),"Searches completed","✓"],
    [count("SELECT COUNT(*) count FROM cp_orders WHERE status='Complete'"),"Reports completed","▣"],
    [count("SELECT COUNT(*) count FROM cp_audit WHERE action LIKE '%reminder%' OR action LIKE '%message%'"),"Messages recorded","✉"],
    [count("SELECT COUNT(*) count FROM cp_vendor_messages"),"Vendor messages","⌄"],
    [count("SELECT COUNT(*) count FROM cp_audit WHERE action LIKE '%Compliance%' OR action LIKE '%QA%'"),"Exceptions routed","↗"],
  ] as const;
  const attention=rows(`SELECT o.*,c.name candidate,cl.name client FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE o.issue!='' ORDER BY CASE o.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,o.aging DESC LIMIT 7`);

  return <div className="page">
    <PageHead eyebrow="OPERATIONS OVERVIEW" title="Operations Dashboard" subtitle="Live workload, aging, and exceptions from the ClearPath database." actions={<><Link href="/app/reports/operations" className="btn outline">▥ Create Operations Report</Link><span className="updated">● Live operational data</span></>}/>
    <div className="metric-grid">{metrics.map(metric=><Link href={metric[4]} className={`metric ${metric[3]}`} key={metric[0]}><div><span>{metric[5]}</span><small>VIEW WORK →</small></div><b>{metric[1]}</b><h3>{metric[0]}</h3><p>{metric[2]}</p></Link>)}</div>
    <div className="dash-grid">
      <section className="card"><div className="card-head"><div><h2>Queue Aging</h2><p>Open orders by time in queue</p></div><Badge tone={oldAging?"amber":"green"}>{oldAging} aging 3+ days</Badge></div><div className="aging-chart">{aging.map(item=><div key={item[0]}><span>{item[0]}</span><i><b style={{width:`${Math.max(4,totalAging?Number(item[1])/totalAging*100:0)}%`,background:item[2]}}></b></i><strong>{item[1]}</strong></div>)}</div><div className="aging-total"><span><b>{totalAging}</b> Total orders</span><span className="red-text"><b>{oldAging}</b> Aging 3+ days</span></div></section>
      <section className="card"><div className="card-head"><div><h2>Recorded Activity</h2><p>Current persisted dataset</p></div><Link href="/app/audit-log">View audit log →</Link></div><div className="activity-grid">{activity.map((item,index)=><div key={item[1]}><span className={`act-icon a${index}`}>{item[2]}</span><p><b>{item[0]}</b><span>{item[1]}</span></p></div>)}</div></section>
    </div>
    <section className="card attention"><div className="card-head"><div><h2>Attention Required <Badge tone="red">{attention.length} priority items</Badge></h2><p>Orders requiring immediate review or action</p></div><Link href="/app/queues">View all queues →</Link></div><table><thead><tr><th>Priority</th><th>Candidate</th><th>Client</th><th>Issue</th><th>Age</th><th>Assigned To</th><th>Status</th><th></th></tr></thead><tbody>{attention.map(record=><tr key={String(record.order_id)}><td><Badge tone={record.priority==="Urgent"?"red":"amber"}>{record.priority}</Badge></td><td><b>{record.candidate}</b></td><td>{record.client}</td><td>{record.issue}</td><td className="red-text">{record.aging} days</td><td>{record.assigned_to}</td><td><Badge tone="gray">{record.status}</Badge></td><td><Link className="table-action" href={`/app/orders/${record.order_id}`}>Open →</Link></td></tr>)}</tbody></table></section>
  </div>;
}
