import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {createOrderNote,orderNotes} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,requiredText} from "../../_shared";

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/);if(!id)return NextResponse.json({error:"Invalid order"},{status:400});
  try{return NextResponse.json({notes:orderNotes(id)})}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["note"]))return NextResponse.json({error:"Invalid note"},{status:400});
  const note=requiredText(body.note,2000);if(!note)return NextResponse.json({error:"Note is required"},{status:400});
  try{return NextResponse.json({note:createOrderNote(id,note,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})},{status:201})}catch(error){return domainError(error)}
}
