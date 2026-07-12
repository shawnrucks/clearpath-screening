import {NextRequest, NextResponse} from "next/server";
import {INTERNAL_ROLES, hasRole, isSameOrigin, sessionFromRequest} from "@/lib/auth";
import {applyPortalAction, getClearPath} from "@/lib/clearpath";

type ActionBody = Record<string, unknown>;
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max ? value.trim() : null;

export async function POST(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  if (!hasRole(session, INTERNAL_ROLES)) return NextResponse.json({error: "Forbidden"}, {status: 403});
  if (!isSameOrigin(request)) return NextResponse.json({error: "Forbidden"}, {status: 403});
  let body: ActionBody;
  try { body = await request.json() as ActionBody; }
  catch { return NextResponse.json({error: "Invalid request"}, {status: 400}); }

  const kind=text(body.kind,32);
  if(kind==="report"){
    if(!hasRole(session,["Administrator","Operations Specialist"]))return NextResponse.json({error:"Forbidden"},{status:403});
    const title=text(body.title,160),summary=text(body.summary,5000),highlights=text(body.highlights,5000);
    if(!title||!summary||!highlights)return NextResponse.json({error:"Invalid report"},{status:400});
    const db=getClearPath();
    db.transaction(()=>{
      db.prepare("INSERT INTO cp_reports(title,summary,highlights,created_by,created_at) VALUES(?,?,?,?,datetime('now'))").run(title,summary,highlights,session.name);
      db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(session.name,session.role,"Operations report saved","Operations Report",title,"",JSON.stringify({title,summary,highlights}),"","Web",session.email);
    })();
    return NextResponse.json({ok:true});
  }
  if(kind)return NextResponse.json({error:"Unsupported action"},{status:400});

  const action=text(body.action,120),entityId=text(body.entityId,100),note=text(body.note,2000)??"";
  if(!action||!entityId)return NextResponse.json({error:"Action and entity are required"},{status:400});
  const managers=["Administrator","Operations Specialist"] as const;
  const permitted=entityId.startsWith("CP-")?hasRole(session,managers)
    :entityId.startsWith("QA-")||entityId==="Selected QA report"?hasRole(session,[...managers,"QA Reviewer"])
    :/^\d+$/.test(entityId)?hasRole(session,[...managers,"Billing Specialist"])
    :entityId.startsWith("SRC-")?hasRole(session,[...managers,"Researcher / Vendor","Compliance Reviewer"])
    :false;
  if(!permitted)return NextResponse.json({error:"Forbidden"},{status:403});
  const rawValues=body.values && typeof body.values==="object" && !Array.isArray(body.values) ? body.values as Record<string,unknown> : {};
  const values:Record<string,string>={};
  for(const [key,value] of Object.entries(rawValues)){
    const safeKey=text(key,80),safeValue=text(value,500);
    if(!safeKey||safeValue===null)return NextResponse.json({error:"Invalid field value"},{status:400});
    values[safeKey]=safeValue;
  }
  try{
    const result=applyPortalAction({action,entityId,values,note},{name:session.name,role:session.role,sessionId:session.email});
    return NextResponse.json({ok:true,result});
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to save changes";
    return NextResponse.json({error:message},{status:message.includes("not found")?404:400});
  }
}
