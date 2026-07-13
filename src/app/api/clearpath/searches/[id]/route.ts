import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {CLEARPATH_SEARCH_STATUSES,CLEARPATH_SEARCH_TYPES,searchByExternalId,updateSearch,type UpdateSearchInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,nonNegativeNumber,objectBody,optionalText,requiredText,validDate} from "@/app/api/clearpath/orders/_shared";

const editors=["Administrator","Operations Specialist","Researcher / Vendor","Compliance Reviewer"] as const;
const keys=["type","jurisdiction","vendor","dateAssigned","dueDate","status","result","vendorCost","courtFee","clientPrice","notes","delayReason","expectedCost","note"] as const;
const researcherKeys=new Set(["dateAssigned","dueDate","status","result","notes","delayReason","note"]);
const complianceKeys=new Set(["status","result","notes","note"]);

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^SRC-\d+$/);if(!id)return NextResponse.json({error:"Invalid search"},{status:400});
  const search=searchByExternalId(id);return search?NextResponse.json({search}):NextResponse.json({error:"Search not found"},{status:404});
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,editors,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^SRC-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid search update"},{status:400});
  const submitted=Object.keys(body);
  if(auth.session.role==="Researcher / Vendor"&&!submitted.every(key=>researcherKeys.has(key))||auth.session.role==="Compliance Reviewer"&&!submitted.every(key=>complianceKeys.has(key)))return NextResponse.json({error:"Forbidden"},{status:403});
  const input:UpdateSearchInput={};
  if("type" in body){const value=requiredText(body.type,160);if(!value||!CLEARPATH_SEARCH_TYPES.includes(value as typeof CLEARPATH_SEARCH_TYPES[number]))return NextResponse.json({error:"Invalid search type"},{status:400});input.type=value}
  if("jurisdiction" in body){const value=requiredText(body.jurisdiction,200);if(!value)return NextResponse.json({error:"Invalid jurisdiction"},{status:400});input.jurisdiction=value}
  if("vendor" in body){const value=requiredText(body.vendor,200);if(!value)return NextResponse.json({error:"Invalid vendor"},{status:400});input.vendor=value}
  if("dateAssigned" in body){const value=validDate(body.dateAssigned);if(!value)return NextResponse.json({error:"Invalid assigned date"},{status:400});input.dateAssigned=value}
  if("dueDate" in body){const value=validDate(body.dueDate);if(!value)return NextResponse.json({error:"Invalid due date"},{status:400});input.dueDate=value}
  if("status" in body){const value=requiredText(body.status,80);if(!value||!CLEARPATH_SEARCH_STATUSES.includes(value as typeof CLEARPATH_SEARCH_STATUSES[number]))return NextResponse.json({error:"Invalid search status"},{status:400});input.status=value}
  if("result" in body){const value=optionalText(body.result,1000);if(value===null)return NextResponse.json({error:"Invalid result"},{status:400});input.result=value}
  if("vendorCost" in body){const value=nonNegativeNumber(body.vendorCost);if(value===null)return NextResponse.json({error:"Invalid vendor cost"},{status:400});input.vendorCost=value}
  if("courtFee" in body){const value=nonNegativeNumber(body.courtFee);if(value===null)return NextResponse.json({error:"Invalid court fee"},{status:400});input.courtFee=value}
  if("clientPrice" in body){const value=nonNegativeNumber(body.clientPrice);if(value===null)return NextResponse.json({error:"Invalid client price"},{status:400});input.clientPrice=value}
  if("notes" in body){const value=optionalText(body.notes,2000);if(value===null)return NextResponse.json({error:"Invalid notes"},{status:400});input.notes=value}
  if("delayReason" in body){const value=optionalText(body.delayReason,500);if(value===null)return NextResponse.json({error:"Invalid delay reason"},{status:400});input.delayReason=value}
  if("expectedCost" in body){const value=nonNegativeNumber(body.expectedCost);if(value===null)return NextResponse.json({error:"Invalid expected cost"},{status:400});input.expectedCost=value}
  const note=body.note===undefined?"":optionalText(body.note,2000);if(note===null)return NextResponse.json({error:"Invalid note"},{status:400});
  try{return NextResponse.json({search:updateSearch(id,input,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email},note)})}catch(error){return domainError(error)}
}
