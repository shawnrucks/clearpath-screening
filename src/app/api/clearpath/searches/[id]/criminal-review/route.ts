import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_CRIMINAL_REVIEW_DECISIONS,createCriminalMatchReview} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,objectBody,requiredText} from "@/app/api/clearpath/orders/_shared";

const reviewers=["Administrator","Operations Specialist","Compliance Reviewer"] as const;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,reviewers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^SRC-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,["decision","note"]))return NextResponse.json({error:"Invalid criminal review"},{status:400});
  const decision=requiredText(body.decision,80),note=requiredText(body.note,2000);if(!decision||!CLEARPATH_CRIMINAL_REVIEW_DECISIONS.includes(decision as typeof CLEARPATH_CRIMINAL_REVIEW_DECISIONS[number])||!note)return NextResponse.json({error:"Invalid criminal review"},{status:400});
  try{return NextResponse.json(createCriminalMatchReview(id,{decision,note},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email}),{status:201})}catch(error){return domainError(error)}
}
