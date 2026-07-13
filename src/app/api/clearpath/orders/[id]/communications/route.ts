import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {createOrderCommunication,orderCommunications} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,requiredText} from "../../_shared";

const writers=["Administrator","Operations Specialist"] as const;
const recipientTypes=["Candidate","Client","Vendor","Other"];
const channels=["Email","Phone","Portal Message","Internal"];
const directions=["Outbound","Inbound"];
const statuses=["Sent","Draft","Logged"];
const keys=["searchId","recipientType","recipient","channel","subject","body","direction","status"] as const;

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/);if(!id)return NextResponse.json({error:"Invalid order"},{status:400});
  try{return NextResponse.json({communications:orderCommunications(id)})}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,writers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid communication"},{status:400});
  const searchId=body.searchId===undefined||body.searchId===""?undefined:requiredText(body.searchId,40),recipientType=requiredText(body.recipientType,40),recipient=requiredText(body.recipient,254),channel=requiredText(body.channel,40),subject=requiredText(body.subject,200),messageBody=requiredText(body.body,5000),direction=body.direction===undefined?"Outbound":requiredText(body.direction,20),status=body.status===undefined?"Sent":requiredText(body.status,20);
  if(body.searchId!==undefined&&body.searchId!==""&&(!searchId||!/^SRC-\d+$/.test(searchId))||!recipientType||!recipientTypes.includes(recipientType)||!recipient||!channel||!channels.includes(channel)||!subject||!messageBody||!direction||!directions.includes(direction)||!status||!statuses.includes(status))return NextResponse.json({error:"Invalid communication"},{status:400});
  try{return NextResponse.json({communication:createOrderCommunication(id,{searchId:searchId||undefined,recipientType,recipient,channel,subject,body:messageBody,direction,status},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})},{status:201})}catch(error){return domainError(error)}
}
