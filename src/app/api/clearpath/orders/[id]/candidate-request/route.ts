import {NextRequest,NextResponse} from "next/server";
import {sendCandidateRequest} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,requiredText,validDate} from "../../_shared";

const managers=["Administrator","Operations Specialist"] as const;
const statuses=["Candidate Action Required","In Progress","On Hold"];
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["templateKey","followUpDate","orderStatus","note"]))return NextResponse.json({error:"Invalid candidate request"},{status:400});
  const templateKey=requiredText(body.templateKey,100),followUpDate=validDate(body.followUpDate),orderStatus=body.orderStatus===undefined?"Candidate Action Required":requiredText(body.orderStatus,80),note=optionalText(body.note,2000);
  if(!templateKey||!followUpDate||!orderStatus||!statuses.includes(orderStatus)||note===null)return NextResponse.json({error:"Invalid candidate request"},{status:400});
  try{return NextResponse.json(sendCandidateRequest(id,{templateKey,followUpDate,orderStatus,note:note||""},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}),{status:201})}catch(error){return domainError(error)}
}
