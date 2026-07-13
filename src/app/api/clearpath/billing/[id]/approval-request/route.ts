import {NextRequest,NextResponse} from "next/server";
import {requestBillingApproval} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,nonNegativeNumber,objectBody,optionalText,requiredText} from "@/app/api/clearpath/orders/_shared";

const specialists=["Administrator","Operations Specialist","Billing Specialist"] as const;
function billingId(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,specialists,true);if("response" in auth)return auth.response;
  const id=billingId((await params).id),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["requestedAmount","reason","note"]))return NextResponse.json({error:"Invalid approval request"},{status:400});
  const requestedAmount=nonNegativeNumber(body.requestedAmount),reason=requiredText(body.reason,500),note=optionalText(body.note,2000);if(requestedAmount===null||requestedAmount<=0||Math.abs(requestedAmount*100-Math.round(requestedAmount*100))>1e-7||!reason||note===null)return NextResponse.json({error:"Invalid approval request"},{status:400});
  try{return NextResponse.json(requestBillingApproval(id,{requestedAmount,reason,note:note||""},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}),{status:201})}catch(error){return domainError(error)}
}
