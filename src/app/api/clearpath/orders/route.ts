import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_ORDER_STATUSES,CLEARPATH_PACKAGES,CLEARPATH_PRIORITIES,createOrder,type CandidateInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,objectBody,optionalText,positiveInteger,requiredText,validDate,validEmail} from "./_shared";

const managers=["Administrator","Operations Specialist"] as const;
const orderKeys=["candidateId","candidate","clientId","position","package","orderDate","targetDate","status","assignedTo","priority","issue","hiringLocation","recruiter"] as const;
const candidateKeys=["name","dob","ssn","email","phone","address","previousAddress","aliases"] as const;

function candidateInput(value:unknown):CandidateInput|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const candidate=value as Record<string,unknown>;
  if(!hasOnlyKeys(candidate,candidateKeys))return null;
  const name=requiredText(candidate.name,160),dob=validDate(candidate.dob),rawSsn=requiredText(candidate.ssn,32),email=validEmail(candidate.email),phone=requiredText(candidate.phone,40),address=requiredText(candidate.address,300),previousAddress=optionalText(candidate.previousAddress,300),aliases=optionalText(candidate.aliases,300);
  if(!name||!dob||!rawSsn||!email||!phone||!address||previousAddress===null||aliases===null||!/^(?:\*{3}-\*{2}-\d{4}|\d{3}-\d{2}-\d{4}|\d{4})$/.test(rawSsn))return null;
  return {name,dob,ssn:`***-**-${rawSsn.slice(-4)}`,email,phone,address,previousAddress:previousAddress||"",aliases:aliases||"None reported"};
}

export async function POST(request:NextRequest){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const body=await objectBody(request);if(!body||!hasOnlyKeys(body,orderKeys))return NextResponse.json({error:"Invalid order"},{status:400});
  const candidateId=body.candidateId===undefined?undefined:positiveInteger(body.candidateId),candidate=body.candidate===undefined?undefined:candidateInput(body.candidate),clientId=positiveInteger(body.clientId),position=requiredText(body.position,160),screeningPackage=requiredText(body.package,80),orderDate=validDate(body.orderDate),targetDate=validDate(body.targetDate),status=body.status===undefined?"Draft":requiredText(body.status,80),assignedTo=body.assignedTo===undefined?"Unassigned":requiredText(body.assignedTo,160),priority=body.priority===undefined?"Normal":requiredText(body.priority,40),issue=body.issue===undefined?"":optionalText(body.issue,500),hiringLocation=requiredText(body.hiringLocation,200),recruiter=requiredText(body.recruiter,160);
  if((candidateId===undefined)===(candidate===undefined)||candidateId===null||body.candidate!==undefined&&!candidate||!clientId||!position||!screeningPackage||!orderDate||!targetDate||!status||!assignedTo||!priority||issue===null||!hiringLocation||!recruiter||!CLEARPATH_PACKAGES.includes(screeningPackage as typeof CLEARPATH_PACKAGES[number])||!CLEARPATH_ORDER_STATUSES.includes(status as typeof CLEARPATH_ORDER_STATUSES[number])||!CLEARPATH_PRIORITIES.includes(priority as typeof CLEARPATH_PRIORITIES[number]))return NextResponse.json({error:"Invalid order"},{status:400});
  try{
    const order=createOrder({candidateId,candidate:candidate||undefined,clientId,position,package:screeningPackage,orderDate,targetDate,status,assignedTo,priority,issue:issue||"",hiringLocation,recruiter},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email});
    return NextResponse.json({order},{status:201});
  }catch(error){return domainError(error)}
}
