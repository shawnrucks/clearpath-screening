import {NextRequest,NextResponse} from "next/server";
import {hasRole,isSameOrigin,sessionFromRequest} from "@/lib/auth";
import {billingExceptionWithInvoices,createInvoice} from "@/lib/clearpath";

const roles=["Administrator","Operations Specialist","Billing Specialist"] as const;
function identifier(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}
function date(value:unknown){if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const parsed=new Date(`${value}T00:00:00Z`);return Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value?null:value}
function errorResponse(error:unknown){const message=error instanceof Error?error.message:"Unable to process invoice";return NextResponse.json({error:message},{status:message.includes("not found")?404:400})}

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=sessionFromRequest(request);if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!hasRole(session,roles))return NextResponse.json({error:"Forbidden"},{status:403});
  const id=identifier((await params).id);if(!id)return NextResponse.json({error:"Invalid billing exception"},{status:400});
  try{return NextResponse.json(billingExceptionWithInvoices(id))}catch(error){return errorResponse(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=sessionFromRequest(request);if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!hasRole(session,roles)||!isSameOrigin(request))return NextResponse.json({error:"Forbidden"},{status:403});
  const id=identifier((await params).id);if(!id)return NextResponse.json({error:"Invalid billing exception"},{status:400});
  let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
  const dueDate=date(body.dueDate),note=typeof body.note==="string"&&body.note.length<=2000?body.note.trim():null;
  if(!dueDate||note===null||!Array.isArray(body.lineItems)||body.lineItems.length<1||body.lineItems.length>50)return NextResponse.json({error:"Invalid invoice"},{status:400});
  const lineItems=[] as {description:string;amount:number}[];
  for(const raw of body.lineItems){if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid invoice line"},{status:400});const item=raw as Record<string,unknown>,description=typeof item.description==="string"&&item.description.trim().length<=300?item.description.trim():"",amount=typeof item.amount==="number"?item.amount:NaN;if(!description||!Number.isFinite(amount)||amount<0||amount>100000||Math.abs(amount*100-Math.round(amount*100))>1e-7)return NextResponse.json({error:"Invalid invoice line"},{status:400});lineItems.push({description,amount})}
  try{return NextResponse.json({invoice:createInvoice(id,{dueDate,note,lineItems},{name:session.name,role:session.role,sessionId:session.email})},{status:201})}catch(error){return errorResponse(error)}
}
