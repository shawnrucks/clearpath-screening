import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {CLEARPATH_VERIFICATION_ATTEMPT_TYPES,CLEARPATH_VERIFICATION_OUTCOMES,createVerificationAttempt,verificationAttempts} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,requiredText,validDate} from "@/app/api/clearpath/orders/_shared";

const writers=["Administrator","Operations Specialist","Researcher / Vendor"] as const;
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^SRC-\d+$/);if(!id)return NextResponse.json({error:"Invalid search"},{status:400});
  try{return NextResponse.json({attempts:verificationAttempts(id)})}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,writers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^SRC-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["attemptType","outcome","nextFollowUp","note"]))return NextResponse.json({error:"Invalid verification attempt"},{status:400});
  const attemptType=requiredText(body.attemptType,40),outcome=requiredText(body.outcome,80),nextFollowUp=body.nextFollowUp===undefined||body.nextFollowUp===""?undefined:validDate(body.nextFollowUp),note=optionalText(body.note,2000);
  const terminal=outcome==="Verified"||outcome==="Unable to Verify";
  if(!attemptType||!CLEARPATH_VERIFICATION_ATTEMPT_TYPES.includes(attemptType as typeof CLEARPATH_VERIFICATION_ATTEMPT_TYPES[number])||!outcome||!CLEARPATH_VERIFICATION_OUTCOMES.includes(outcome as typeof CLEARPATH_VERIFICATION_OUTCOMES[number])||body.nextFollowUp!==undefined&&body.nextFollowUp!==""&&!nextFollowUp||!terminal&&!nextFollowUp||note===null)return NextResponse.json({error:"Invalid verification attempt"},{status:400});
  try{return NextResponse.json(createVerificationAttempt(id,{attemptType,outcome,nextFollowUp:nextFollowUp||undefined,note:note||""},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}),{status:201})}catch(error){return domainError(error)}
}
