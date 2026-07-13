import {NextRequest,NextResponse} from "next/server";
import {hasRole,isSameOrigin,sessionFromRequest,type Session} from "@/lib/auth";

export function authorize(request:NextRequest,roles:readonly string[],write=false):{session:Session}|{response:NextResponse}{
  const session=sessionFromRequest(request);
  if(!session)return {response:NextResponse.json({error:"Unauthorized"},{status:401})};
  if(!hasRole(session,roles)||(write&&!isSameOrigin(request)))return {response:NextResponse.json({error:"Forbidden"},{status:403})};
  return {session};
}

export async function objectBody(request:NextRequest){
  try{const body=await request.json();return body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:null}catch{return null}
}
export function hasOnlyKeys(body:Record<string,unknown>,allowed:readonly string[]){return Object.keys(body).every(key=>allowed.includes(key))}
export function requiredText(value:unknown,max:number){return typeof value==="string"&&value.trim().length>0&&value.trim().length<=max?value.trim():null}
export function optionalText(value:unknown,max:number){if(value===undefined)return undefined;return typeof value==="string"&&value.trim().length<=max?value.trim():null}
export function positiveInteger(value:unknown){return typeof value==="number"&&Number.isInteger(value)&&value>0?value:null}
export function nonNegativeNumber(value:unknown,max=100000){return typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=max?value:null}
export function validDate(value:unknown){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:null;
}
export function validEmail(value:unknown){const email=requiredText(value,254);return email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null}
export function identifier(value:string,pattern:RegExp){const decoded=decodeURIComponent(value);return pattern.test(decoded)?decoded:null}
export function domainError(error:unknown){
  const message=error instanceof Error?error.message:"Unable to save changes";
  return NextResponse.json({error:message},{status:message.toLowerCase().includes("not found")?404:400});
}
