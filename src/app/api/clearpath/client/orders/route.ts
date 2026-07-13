import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_PACKAGES,CLEARPATH_PRIORITIES,clientPortalOrders,createClientSubmittedOrder,type CandidateInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,objectBody,optionalText,requiredText,validDate,validEmail} from "@/app/api/clearpath/orders/_shared";

const clientRole=["Client Administrator"] as const;
const candidateKeys=["name","dob","ssn","email","phone","address","previousAddress","aliases"] as const;
function candidateInput(value:unknown):CandidateInput|null{
  if(!value||typeof value!=="object"||Array.isArray(value)||!hasOnlyKeys(value as Record<string,unknown>,candidateKeys))return null;
  const candidate=value as Record<string,unknown>,name=requiredText(candidate.name,160),dob=validDate(candidate.dob),rawSsn=requiredText(candidate.ssn,32),email=validEmail(candidate.email),phone=requiredText(candidate.phone,40),address=requiredText(candidate.address,300),previousAddress=optionalText(candidate.previousAddress,300),aliases=optionalText(candidate.aliases,300);
  if(!name||!dob||!rawSsn||!email||!phone||!address||previousAddress===null||aliases===null||!/^(?:\*{3}-\*{2}-\d{4}|\d{3}-\d{2}-\d{4}|\d{4})$/.test(rawSsn))return null;
  return {name,dob,ssn:`***-**-${rawSsn.slice(-4)}`,email,phone,address,previousAddress:previousAddress||"",aliases:aliases||"None reported"};
}
export async function GET(request:NextRequest){
  const auth=authorize(request,clientRole);if("response" in auth)return auth.response;
  try{return NextResponse.json(clientPortalOrders(auth.session.email))}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest){
  const auth=authorize(request,clientRole,true);if("response" in auth)return auth.response;
  const body=await objectBody(request);if(!body||!hasOnlyKeys(body,["candidate","position","package","targetDate","priority","hiringLocation","recruiter"]))return NextResponse.json({error:"Invalid client order"},{status:400});
  const candidate=candidateInput(body.candidate),position=requiredText(body.position,160),screeningPackage=requiredText(body.package,80),targetDate=validDate(body.targetDate),priority=body.priority===undefined?"Normal":requiredText(body.priority,40),hiringLocation=requiredText(body.hiringLocation,200),recruiter=requiredText(body.recruiter,160);
  if(!candidate||!position||!screeningPackage||!CLEARPATH_PACKAGES.includes(screeningPackage as typeof CLEARPATH_PACKAGES[number])||!targetDate||!priority||!CLEARPATH_PRIORITIES.includes(priority as typeof CLEARPATH_PRIORITIES[number])||!hiringLocation||!recruiter)return NextResponse.json({error:"Invalid client order"},{status:400});
  try{return NextResponse.json({order:createClientSubmittedOrder(auth.session.email,{candidate,position,package:screeningPackage,targetDate,priority,hiringLocation,recruiter},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})},{status:201})}catch(error){return domainError(error)}
}
