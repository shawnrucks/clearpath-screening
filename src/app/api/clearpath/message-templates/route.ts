import {NextRequest,NextResponse} from "next/server";
import {INTERNAL_ROLES} from "@/lib/auth";
import {messageTemplates} from "@/lib/clearpath";
import {authorize} from "@/app/api/clearpath/orders/_shared";

export async function GET(request:NextRequest){
  const auth=authorize(request,INTERNAL_ROLES);if("response" in auth)return auth.response;
  const audience=request.nextUrl.searchParams.get("audience")||undefined;
  if(audience&&!['Candidate','Client'].includes(audience))return NextResponse.json({error:"Invalid audience"},{status:400});
  return NextResponse.json({templates:messageTemplates(audience)});
}
