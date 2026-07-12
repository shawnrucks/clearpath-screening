import {NextRequest, NextResponse} from "next/server";
import {clearSessionCookie, isSameOrigin} from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Forbidden"}, {status: 403});
  const response = NextResponse.json({ok: true});
  clearSessionCookie(response);
  response.cookies.delete("cp_user");
  return response;
}
