import {notFound} from "next/navigation";
import {rows} from "@/lib/clearpath";
import {PageHead} from "@/components/Portal";
import RecordsExplorer, {type ExplorerRecord} from "./RecordsExplorer";

const titles:Record<string,[string,string,string]> = {
  candidates:["Candidates","Candidate identity, contact information, and screening activity.","Candidates"],
  searches:["Searches","Individual screening components, jurisdictions, assignments, and deadlines.","Searches"],
  clients:["Clients","Employer accounts, industries, and current screening workload.","Clients"],
};

export default async function RecordsPage({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  const title=titles[section];
  if(!title) notFound();
  let records:ExplorerRecord[]=[];
  if(section==="candidates") {
    records=rows(`SELECT c.id,c.name,c.email,c.phone,c.address,COUNT(o.id) order_count,MAX(o.order_id) latest_order,
      COALESCE((SELECT cl.name FROM cp_orders recent JOIN cp_clients cl ON cl.id=recent.client_id WHERE recent.candidate_id=c.id ORDER BY recent.id DESC LIMIT 1),'—') latest_client
      FROM cp_candidates c LEFT JOIN cp_orders o ON o.candidate_id=c.id GROUP BY c.id ORDER BY c.name`).map(row=>({
        id:String(row.id), href:row.latest_order?`/app/orders/${row.latest_order}?tab=candidate`:"/app/orders",
        values:{Candidate:String(row.name),Email:String(row.email),Phone:String(row.phone),Address:String(row.address),"Active orders":Number(row.order_count),"Latest client":String(row.latest_client)},
      }));
  } else if(section==="searches") {
    records=rows(`SELECT s.search_id,s.type,s.jurisdiction,s.vendor,s.due_date,s.status,o.order_id,c.name candidate,cl.name client
      FROM cp_searches s JOIN cp_orders o ON o.id=s.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id ORDER BY s.id`).map(row=>({
        id:String(row.search_id), href:`/app/orders/${row.order_id}?tab=searches`,
        values:{"Search ID":String(row.search_id),Type:String(row.type),Candidate:String(row.candidate),Client:String(row.client),Jurisdiction:String(row.jurisdiction),Vendor:String(row.vendor),Due:String(row.due_date),Status:String(row.status)},
      }));
  } else {
    records=rows(`SELECT cl.id,cl.name,cl.industry,cl.status,COUNT(o.id) order_count,SUM(CASE WHEN o.status!='Complete' THEN 1 ELSE 0 END) open_count,MAX(o.order_id) latest_order
      FROM cp_clients cl LEFT JOIN cp_orders o ON o.client_id=cl.id GROUP BY cl.id ORDER BY cl.name`).map(row=>({
        id:String(row.id), href:`/app/orders?client=${encodeURIComponent(String(row.name))}`,
        values:{Client:String(row.name),Industry:String(row.industry),Status:String(row.status),"Total orders":Number(row.order_count),"Open orders":Number(row.open_count||0)},
      }));
  }
  return <div className="page"><PageHead eyebrow="OPERATIONS" title={title[0]} subtitle={title[1]}/><RecordsExplorer records={records} noun={title[2]}/></div>;
}
