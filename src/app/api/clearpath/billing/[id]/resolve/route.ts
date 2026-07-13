import {NextRequest,NextResponse} from "next/server";
import {resolveBillingException} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,nonNegativeNumber,objectBody,requiredText} from "@/app/api/clearpath/orders/_shared";

const specialists=["Administrator","Operations Specialist","Billing Specialist"] as const;
function billingId(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,specialists,true);if("response" in auth)return auth.response;
  const id=billingId((await params).id),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["correctedFee","note"]))return NextResponse.json({error:"Invalid billing resolution"},{status:400});
  const correctedFee=nonNegativeNumber(body.correctedFee),note=requiredText(body.note,2000);if(correctedFee===null||Math.abs(correctedFee*100-Math.round(correctedFee*100))>1e-7||!note)return NextResponse.json({error:"Invalid billing resolution"},{status:400});
  try{return NextResponse.json({billing:resolveBillingException(id,{correctedFee,note},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})})}catch(error){return domainError(error)}
}
