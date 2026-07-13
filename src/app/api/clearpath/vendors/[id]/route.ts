import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {updateVendor,vendorById,type UpdateVendorInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,nonNegativeNumber,objectBody,optionalText,requiredText,validEmail} from "@/app/api/clearpath/orders/_shared";

const managers=["Administrator","Operations Specialist"] as const;
const keys=["name","coverage","jurisdictions","turnaround","cost","quality","preferred","status","contact","note"] as const;
function vendorId(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=vendorId((await params).id);if(!id)return NextResponse.json({error:"Invalid vendor"},{status:400});const vendor=vendorById(id);return vendor?NextResponse.json({vendor}):NextResponse.json({error:"Vendor not found"},{status:404});
}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const id=vendorId((await params).id),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid vendor update"},{status:400});const input:UpdateVendorInput={};
  for(const key of ["name","coverage","jurisdictions","turnaround"] as const){if(key in body){const value=requiredText(body[key],key==="name"?160:300);if(!value)return NextResponse.json({error:`Invalid ${key}`},{status:400});input[key]=value}}
  if("cost" in body){const value=nonNegativeNumber(body.cost);if(value===null||Math.abs(value*100-Math.round(value*100))>1e-7)return NextResponse.json({error:"Invalid cost"},{status:400});input.cost=value}
  if("quality" in body){if(typeof body.quality!=="number"||!Number.isInteger(body.quality)||body.quality<0||body.quality>100)return NextResponse.json({error:"Invalid quality"},{status:400});input.quality=body.quality}
  if("preferred" in body){if(typeof body.preferred!=="boolean")return NextResponse.json({error:"Invalid preferred flag"},{status:400});input.preferred=body.preferred}
  if("status" in body){const value=requiredText(body.status,20);if(!value||!["Active","Inactive"].includes(value))return NextResponse.json({error:"Invalid status"},{status:400});input.status=value}
  if("contact" in body){const value=validEmail(body.contact);if(!value)return NextResponse.json({error:"Invalid contact"},{status:400});input.contact=value}
  const note=body.note===undefined?"":optionalText(body.note,2000);if(note===null)return NextResponse.json({error:"Invalid note"},{status:400});
  try{return NextResponse.json({vendor:updateVendor(id,input,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email},note)})}catch(error){return domainError(error)}
}
