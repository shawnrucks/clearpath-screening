import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES,hasRole,sessionFromRequest} from "@/lib/auth";
import {rows} from "@/lib/clearpath";

const allowed=new Set([
  "candidate-missing-information","new-order-review","reports-ready-to-release",
  "billing-exceptions","reports-ready-for-qa","unassigned-searches",
  "overdue-searches","record-review","verification-follow-up",
]);

function queueSql(slug:string){
  if(slug==="candidate-missing-information")return `SELECT o.id,o.order_id record_id,o.order_id,c.name candidate,cl.name client,o.position,o.issue,o.status,o.aging,o.assigned_to FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE o.status='Candidate Action Required' ORDER BY o.id LIMIT 6`;
  if(slug==="new-order-review")return `SELECT o.id,o.order_id record_id,o.order_id,c.name candidate,cl.name client,o.position,o.issue,o.status,o.aging,o.assigned_to FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE o.id<=18 ORDER BY o.id LIMIT 18`;
  if(slug==="reports-ready-to-release")return `SELECT q.id,q.qa_id record_id,q.qa_id,o.order_id,c.name candidate,cl.name client,o.position,o.issue,q.status,q.age aging,q.reviewer assigned_to FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE q.status='Approved' AND q.decision='Approve' ORDER BY q.id LIMIT 12`;
  if(slug==="reports-ready-for-qa")return `SELECT q.id,q.qa_id record_id,q.qa_id,o.order_id,c.name candidate,cl.name client,o.position,'QA preparation required' issue,q.status,q.age aging,q.reviewer assigned_to FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE q.status='Pending Review' ORDER BY q.id LIMIT 10`;
  if(slug==="billing-exceptions")return `SELECT b.id,'BILL-'||b.id record_id,b.id billing_id,o.order_id,c.name candidate,cl.name client,o.position,b.issue,b.status,o.aging,o.assigned_to,s.search_id,s.type,s.jurisdiction,s.due_date,s.vendor FROM cp_billing b JOIN cp_orders o ON o.id=b.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id LEFT JOIN cp_searches s ON s.id=b.search_id WHERE b.status NOT IN ('Resolved','Invoiced') ORDER BY b.id LIMIT 5`;
  const base=`SELECT s.id,s.search_id record_id,s.search_id,o.order_id,c.name candidate,cl.name client,o.position,o.issue,s.status,o.aging,o.assigned_to,s.type,s.jurisdiction,s.due_date,s.vendor,s.result,s.notes FROM cp_searches s JOIN cp_orders o ON o.id=s.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id `;
  if(slug==="unassigned-searches")return `${base}WHERE s.vendor='Unassigned' ORDER BY s.id LIMIT 10`;
  if(slug==="overdue-searches")return `${base}WHERE s.due_date<'2026-07-12' AND s.status NOT IN ('Completed','Cancelled','Unable to Complete') ORDER BY s.due_date,s.id LIMIT 8`;
  if(slug==="record-review")return `${base}WHERE s.status='Possible Record' AND s.type IN ('County Criminal Search','National Criminal Database') ORDER BY s.id LIMIT 3`;
  return `${base}WHERE s.type IN ('Employment Verification','Education Verification') AND s.status NOT IN ('Completed','Cancelled','Unable to Complete') ORDER BY s.due_date,s.id LIMIT 14`;
}

export async function GET(request:NextRequest){
  const session=sessionFromRequest(request);
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!hasRole(session,INTERNAL_ROLES))return NextResponse.json({error:"Forbidden"},{status:403});
  const slug=request.nextUrl.searchParams.get("slug");
  if(!slug||!allowed.has(slug))return NextResponse.json({error:"Unknown queue"},{status:404});
  return NextResponse.json(rows(queueSql(slug)));
}
