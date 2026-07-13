import {NextRequest,NextResponse} from "next/server";
import {candidatePortalState,recordCandidatePortalDocument} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,objectBody,optionalText,requiredText} from "@/app/api/clearpath/orders/_shared";

const candidateRole=["Candidate"] as const;
const documentTypes=["Candidate Authorization","Identity Document","Supporting Document","Other"];
const mimeExtensions:Record<string,string[]>={"application/pdf":[".pdf"],"image/png":[".png"],"image/jpeg":[".jpg",".jpeg"]};
export async function GET(request:NextRequest){
  const auth=authorize(request,candidateRole);if("response" in auth)return auth.response;
  try{return NextResponse.json({documents:candidatePortalState(auth.session.email).documents})}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest){
  const auth=authorize(request,candidateRole,true);if("response" in auth)return auth.response;
  const body=await objectBody(request);if(!body||!hasOnlyKeys(body,["name","documentType","mimeType","sizeBytes","storageReference"]))return NextResponse.json({error:"Invalid candidate document"},{status:400});
  const name=requiredText(body.name,240),documentType=requiredText(body.documentType,80),mimeType=requiredText(body.mimeType,160),storageReference=optionalText(body.storageReference,500),sizeBytes=body.sizeBytes,extensions=mimeType?mimeExtensions[mimeType]:undefined,lowerName=name?.toLowerCase();
  if(!name||name==="."||name===".."||/[\\/]/.test(name)||!documentType||!documentTypes.includes(documentType)||!mimeType||!extensions||!lowerName||!extensions.some(extension=>lowerName.endsWith(extension))||typeof sizeBytes!=="number"||!Number.isInteger(sizeBytes)||sizeBytes<0||sizeBytes>25*1024*1024||storageReference===null)return NextResponse.json({error:"Invalid candidate document"},{status:400});
  try{return NextResponse.json(recordCandidatePortalDocument(auth.session.email,{name,documentType,mimeType,sizeBytes,storageReference:storageReference||undefined},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}),{status:201})}catch(error){return domainError(error)}
}
