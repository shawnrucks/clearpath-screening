import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {createOrderDocument,orderDocuments} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,optionalText,requiredText} from "../../_shared";

const writers=["Administrator","Operations Specialist","QA Reviewer","Researcher / Vendor"] as const;
const documentTypes=["Candidate Authorization","Court Record","Verification Evidence","Identity Document","QA Evidence","Other"];
const mimeExtensions:Record<string,string[]>={"application/pdf":[".pdf"],"image/png":[".png"],"image/jpeg":[".jpg",".jpeg"],"text/plain":[".txt"],"application/vnd.openxmlformats-officedocument.wordprocessingml.document":[".docx"]};
const keys=["searchId","name","documentType","mimeType","sizeBytes","storageReference"] as const;

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/);if(!id)return NextResponse.json({error:"Invalid order"},{status:400});
  try{return NextResponse.json({documents:orderDocuments(id)})}catch(error){return domainError(error)}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,writers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid recorded document"},{status:400});
  const searchId=body.searchId===undefined||body.searchId===""?undefined:requiredText(body.searchId,40),name=requiredText(body.name,240),documentType=requiredText(body.documentType,80),mimeType=requiredText(body.mimeType,160),sizeBytes=body.sizeBytes,storageReference=optionalText(body.storageReference,500);
  const extensions=mimeType?mimeExtensions[mimeType]:undefined,lowerName=name?.toLowerCase();
  if(body.searchId!==undefined&&body.searchId!==""&&(!searchId||!/^SRC-\d+$/.test(searchId))||!name||name==="."||name===".."||/[\\/]/.test(name)||!documentType||!documentTypes.includes(documentType)||!mimeType||!extensions||!lowerName||!extensions.some(extension=>lowerName.endsWith(extension))||typeof sizeBytes!=="number"||!Number.isInteger(sizeBytes)||sizeBytes<0||sizeBytes>25*1024*1024||storageReference===null)return NextResponse.json({error:"Invalid recorded document"},{status:400});
  try{return NextResponse.json({document:createOrderDocument(id,{searchId:searchId||undefined,name,documentType,mimeType,sizeBytes,storageReference:storageReference||undefined},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email})},{status:201})}catch(error){return domainError(error)}
}
