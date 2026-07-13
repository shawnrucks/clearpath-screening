import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {CLEARPATH_ORDER_STATUSES,CLEARPATH_PACKAGES,CLEARPATH_PRIORITIES,orderByExternalId,updateOrder,type UpdateOrderInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,positiveInteger,requiredText,validDate} from "../_shared";

const managers=["Administrator","Operations Specialist"] as const;
const keys=["clientId","position","package","targetDate","status","assignedTo","priority","issue","hiringLocation","recruiter","note"] as const;

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/);if(!id)return NextResponse.json({error:"Invalid order"},{status:400});
  const order=orderByExternalId(id);return order?NextResponse.json({order}):NextResponse.json({error:"Order not found"},{status:404});
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid order update"},{status:400});
  const input:UpdateOrderInput={};
  if("clientId" in body){const value=positiveInteger(body.clientId);if(!value)return NextResponse.json({error:"Invalid client"},{status:400});input.clientId=value}
  if("position" in body){const value=requiredText(body.position,160);if(!value)return NextResponse.json({error:"Invalid position"},{status:400});input.position=value}
  if("package" in body){const value=requiredText(body.package,80);if(!value||!CLEARPATH_PACKAGES.includes(value as typeof CLEARPATH_PACKAGES[number]))return NextResponse.json({error:"Invalid package"},{status:400});input.package=value}
  if("targetDate" in body){const value=validDate(body.targetDate);if(!value)return NextResponse.json({error:"Invalid target date"},{status:400});input.targetDate=value}
  if("status" in body){const value=requiredText(body.status,80);if(!value||!CLEARPATH_ORDER_STATUSES.includes(value as typeof CLEARPATH_ORDER_STATUSES[number]))return NextResponse.json({error:"Invalid order status"},{status:400});input.status=value}
  if("assignedTo" in body){const value=requiredText(body.assignedTo,160);if(!value)return NextResponse.json({error:"Invalid assignee"},{status:400});input.assignedTo=value}
  if("priority" in body){const value=requiredText(body.priority,40);if(!value||!CLEARPATH_PRIORITIES.includes(value as typeof CLEARPATH_PRIORITIES[number]))return NextResponse.json({error:"Invalid priority"},{status:400});input.priority=value}
  if("issue" in body){const value=optionalText(body.issue,500);if(value===null)return NextResponse.json({error:"Invalid issue"},{status:400});input.issue=value}
  if("hiringLocation" in body){const value=requiredText(body.hiringLocation,200);if(!value)return NextResponse.json({error:"Invalid hiring location"},{status:400});input.hiringLocation=value}
  if("recruiter" in body){const value=requiredText(body.recruiter,160);if(!value)return NextResponse.json({error:"Invalid recruiter"},{status:400});input.recruiter=value}
  const note=body.note===undefined?"":optionalText(body.note,2000);if(note===null)return NextResponse.json({error:"Invalid note"},{status:400});
  try{return NextResponse.json({order:updateOrder(id,input,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email},note)})}catch(error){return domainError(error)}
}
