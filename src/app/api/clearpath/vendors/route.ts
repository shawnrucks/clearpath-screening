import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {createVendor,vendorsList} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,nonNegativeNumber,objectBody,requiredText,validEmail} from "@/app/api/clearpath/orders/_shared";

const managers=["Administrator","Operations Specialist"] as const;
export async function GET(request:NextRequest){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  return NextResponse.json({vendors:vendorsList()});
}
export async function POST(request:NextRequest){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const body=await objectBody(request);if(!body||!hasOnlyKeys(body,["name","coverage","jurisdictions","turnaround","cost","quality","preferred","status","contact"]))return NextResponse.json({error:"Invalid vendor"},{status:400});
  const name=requiredText(body.name,160),coverage=requiredText(body.coverage,300),jurisdictions=requiredText(body.jurisdictions,300),turnaround=requiredText(body.turnaround,100),cost=nonNegativeNumber(body.cost),quality=body.quality,status=requiredText(body.status,20),contact=validEmail(body.contact);
  if(!name||!coverage||!jurisdictions||!turnaround||cost===null||Math.abs(cost*100-Math.round(cost*100))>1e-7||typeof quality!=="number"||!Number.isInteger(quality)||quality<0||quality>100||typeof body.preferred!=="boolean"||!status||!["Active","Inactive"].includes(status)||!contact)return NextResponse.json({error:"Invalid vendor"},{status:400});
  try{return NextResponse.json({vendor:createVendor({name,coverage,jurisdictions,turnaround,cost,quality,preferred:body.preferred,status,contact},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})},{status:201})}catch(error){return domainError(error)}
}
