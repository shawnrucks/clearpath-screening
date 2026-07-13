import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_QA_DECISIONS,CLEARPATH_QA_RETURN_REASONS,decideQaItem} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,requiredText} from "@/app/api/clearpath/orders/_shared";

const reviewers=["Administrator","QA Reviewer"] as const;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,reviewers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^QA-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["decision","returnReason","note"]))return NextResponse.json({error:"Invalid QA decision"},{status:400});
  const decision=requiredText(body.decision,80),returnReason=body.returnReason===undefined||body.returnReason===""?undefined:requiredText(body.returnReason,100),note=optionalText(body.note,2000),requiresNote=decision==="Return to Operations"||decision==="Request Additional Research"||decision==="Escalate to Compliance";
  if(!decision||!CLEARPATH_QA_DECISIONS.includes(decision as typeof CLEARPATH_QA_DECISIONS[number])||decision==="Return to Operations"&&(!returnReason||!CLEARPATH_QA_RETURN_REASONS.includes(returnReason as typeof CLEARPATH_QA_RETURN_REASONS[number]))||decision!=="Return to Operations"&&returnReason!==undefined||note===null||requiresNote&&!note)return NextResponse.json({error:"Invalid QA decision"},{status:400});
  try{return NextResponse.json(decideQaItem(id,{decision,returnReason:returnReason||undefined,note:note||""},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}))}catch(error){return domainError(error)}
}
