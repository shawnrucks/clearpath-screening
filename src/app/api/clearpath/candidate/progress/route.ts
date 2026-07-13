import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_CANDIDATE_STEPS,candidatePortalState,updateCandidatePortalProgress,type CandidatePortalProgressInput} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,objectBody,optionalText,requiredText,validEmail} from "@/app/api/clearpath/orders/_shared";

const candidateRole=["Candidate"] as const;
export async function GET(request:NextRequest){
  const auth=authorize(request,candidateRole);if("response" in auth)return auth.response;
  try{return NextResponse.json(candidatePortalState(auth.session.email))}catch(error){return domainError(error)}
}
export async function PATCH(request:NextRequest){
  const auth=authorize(request,candidateRole,true);if("response" in auth)return auth.response;
  const body=await objectBody(request);if(!body||!hasOnlyKeys(body,["step","status","personal","address","acknowledged","signatureName"]))return NextResponse.json({error:"Invalid candidate progress"},{status:400});
  const step=requiredText(body.step,80),status=requiredText(body.status,20);if(!step||!CLEARPATH_CANDIDATE_STEPS.includes(step as typeof CLEARPATH_CANDIDATE_STEPS[number])||!status||!["In Progress","Complete"].includes(status))return NextResponse.json({error:"Invalid candidate progress"},{status:400});
  const input:CandidatePortalProgressInput={step,status};
  if(step==="Personal Information"){
    if(body.address!==undefined||body.acknowledged!==undefined||body.signatureName!==undefined)return NextResponse.json({error:"Invalid personal-information update"},{status:400});
    if(body.personal!==undefined){if(!body.personal||typeof body.personal!=="object"||Array.isArray(body.personal)||!hasOnlyKeys(body.personal as Record<string,unknown>,["name","email","phone"]))return NextResponse.json({error:"Invalid personal information"},{status:400});const raw=body.personal as Record<string,unknown>,name=optionalText(raw.name,160),email=raw.email===undefined?undefined:validEmail(raw.email),phone=optionalText(raw.phone,40);if(name===null||raw.email!==undefined&&!email||phone===null)return NextResponse.json({error:"Invalid personal information"},{status:400});input.personal={...(name!==undefined?{name}:{}),...(email?{email}:{}),...(phone!==undefined?{phone}:{})}}
  }else if(step==="Address History"){
    if(body.personal!==undefined||body.acknowledged!==undefined||body.signatureName!==undefined||!body.address||typeof body.address!=="object"||Array.isArray(body.address)||!hasOnlyKeys(body.address as Record<string,unknown>,["address","previousAddress"]))return NextResponse.json({error:"Invalid address history"},{status:400});const raw=body.address as Record<string,unknown>,address=optionalText(raw.address,300),previousAddress=optionalText(raw.previousAddress,300);if(address===null||previousAddress===null)return NextResponse.json({error:"Invalid address history"},{status:400});input.address={...(address!==undefined?{address}:{}),...(previousAddress!==undefined?{previousAddress}:{})};
  }else if(step==="Disclosure Review"){
    if(body.personal!==undefined||body.address!==undefined||body.signatureName!==undefined||body.acknowledged!==undefined&&typeof body.acknowledged!=="boolean"||status==="Complete"&&body.acknowledged!==true)return NextResponse.json({error:"Disclosure acknowledgement is required"},{status:400});input.acknowledged=body.acknowledged as boolean|undefined;
  }else{
    if(body.personal!==undefined||body.address!==undefined||body.acknowledged!==undefined)return NextResponse.json({error:"Invalid authorization"},{status:400});const signatureName=body.signatureName===undefined?undefined:requiredText(body.signatureName,160);if(body.signatureName!==undefined&&!signatureName||status==="Complete"&&!signatureName)return NextResponse.json({error:"Signature name is required"},{status:400});input.signatureName=signatureName||undefined;
  }
  try{return NextResponse.json(updateCandidatePortalProgress(auth.session.email,input,{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}))}catch(error){return domainError(error)}
}
