import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {candidateById,updateCandidate,type UpdateCandidateInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,objectBody,optionalText,requiredText,validDate,validEmail} from "@/app/api/clearpath/orders/_shared";

const managers=["Administrator","Operations Specialist"] as const;
const keys=["name","dob","ssn","email","phone","address","previousAddress","aliases","note"] as const;
function candidateId(value:string){const id=Number(value);return Number.isInteger(id)&&id>0?id:null}

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=candidateId((await params).id);if(!id)return NextResponse.json({error:"Invalid candidate"},{status:400});
  const candidate=candidateById(id);return candidate?NextResponse.json({candidate}):NextResponse.json({error:"Candidate not found"},{status:404});
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const id=candidateId((await params).id),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid candidate update"},{status:400});
  const input:UpdateCandidateInput={};
  if("name" in body){const value=requiredText(body.name,160);if(!value)return NextResponse.json({error:"Invalid candidate name"},{status:400});input.name=value}
  if("dob" in body){const value=validDate(body.dob);if(!value)return NextResponse.json({error:"Invalid date of birth"},{status:400});input.dob=value}
  if("ssn" in body){const raw=requiredText(body.ssn,32);if(!raw||!/^(?:\*{3}-\*{2}-\d{4}|\d{3}-\d{2}-\d{4}|\d{4})$/.test(raw))return NextResponse.json({error:"Invalid SSN"},{status:400});input.ssn=`***-**-${raw.slice(-4)}`}
  if("email" in body){const value=validEmail(body.email);if(!value)return NextResponse.json({error:"Invalid email"},{status:400});input.email=value}
  if("phone" in body){const value=requiredText(body.phone,40);if(!value)return NextResponse.json({error:"Invalid phone"},{status:400});input.phone=value}
  if("address" in body){const value=requiredText(body.address,300);if(!value)return NextResponse.json({error:"Invalid address"},{status:400});input.address=value}
  if("previousAddress" in body){const value=optionalText(body.previousAddress,300);if(value===null)return NextResponse.json({error:"Invalid previous address"},{status:400});input.previousAddress=value}
  if("aliases" in body){const value=optionalText(body.aliases,300);if(value===null)return NextResponse.json({error:"Invalid aliases"},{status:400});input.aliases=value}
  const note=body.note===undefined?"":optionalText(body.note,2000);if(note===null)return NextResponse.json({error:"Invalid note"},{status:400});
  try{return NextResponse.json({candidate:updateCandidate(id,input,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email},note)})}catch(error){return domainError(error)}
}
