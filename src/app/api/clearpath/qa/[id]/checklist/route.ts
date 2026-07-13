import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {qaChecklist,updateQaChecklist} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,requiredText} from "@/app/api/clearpath/orders/_shared";

const writers=["Administrator","Operations Specialist","QA Reviewer"] as const;
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^QA-\d+$/);if(!id)return NextResponse.json({error:"Invalid QA item"},{status:400});
  try{return NextResponse.json(qaChecklist(id))}catch(error){return domainError(error)}
}
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,writers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^QA-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["items"])||!Array.isArray(body.items)||body.items.length<1||body.items.length>30)return NextResponse.json({error:"Invalid QA checklist"},{status:400});
  const items:{key:string;completed:boolean;note:string}[]=[],keys=new Set<string>();
  for(const raw of body.items){if(!raw||typeof raw!=="object"||Array.isArray(raw)||!hasOnlyKeys(raw as Record<string,unknown>,["key","completed","note"]))return NextResponse.json({error:"Invalid QA checklist item"},{status:400});const item=raw as Record<string,unknown>,key=requiredText(item.key,80),note=optionalText(item.note,500);if(!key||keys.has(key)||typeof item.completed!=="boolean"||note===null)return NextResponse.json({error:"Invalid QA checklist item"},{status:400});keys.add(key);items.push({key,completed:item.completed,note:note||""})}
  try{return NextResponse.json(updateQaChecklist(id,{items},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}))}catch(error){return domainError(error)}
}
