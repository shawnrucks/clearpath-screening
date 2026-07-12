import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES,hasRole,isSameOrigin,sessionFromRequest} from "@/lib/auth";
import {createVendorMessage,vendorWithMessages} from "@/lib/clearpath";

function identifier(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}
function date(value:unknown){if(value===undefined||value===null||value==="")return undefined;if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const parsed=new Date(`${value}T00:00:00Z`);return Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value?null:value}
function errorResponse(error:unknown){const message=error instanceof Error?error.message:"Unable to process vendor message";return NextResponse.json({error:message},{status:message.includes("not found")?404:400})}

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=sessionFromRequest(request);if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!hasRole(session,INTERNAL_ROLES))return NextResponse.json({error:"Forbidden"},{status:403});
  const id=identifier((await params).id);if(!id)return NextResponse.json({error:"Invalid vendor"},{status:400});
  try{return NextResponse.json(vendorWithMessages(id))}catch(error){return errorResponse(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=sessionFromRequest(request);if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!hasRole(session,INTERNAL_ROLES)||!isSameOrigin(request))return NextResponse.json({error:"Forbidden"},{status:403});
  const id=identifier((await params).id);if(!id)return NextResponse.json({error:"Invalid vendor"},{status:400});
  let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
  const subject=typeof body.subject==="string"&&body.subject.trim().length<=200?body.subject.trim():"",messageBody=typeof body.body==="string"&&body.body.trim().length<=5000?body.body.trim():"",searchId=body.searchId===undefined||body.searchId===""?undefined:typeof body.searchId==="string"&&/^SRC-\d+$/.test(body.searchId)?body.searchId: null,followUpDate=date(body.followUpDate);
  if(!subject||!messageBody||searchId===null||followUpDate===null)return NextResponse.json({error:"Invalid vendor message"},{status:400});
  try{return NextResponse.json({message:createVendorMessage(id,{subject,body:messageBody,searchId,followUpDate},{name:session.name,role:session.role,sessionId:session.email})},{status:201})}catch(error){return errorResponse(error)}
}
