import {NextRequest, NextResponse} from "next/server";
import {hasRole, isSameOrigin, sessionFromRequest} from "@/lib/auth";
import {resetClearPath} from "@/lib/clearpath";

export async function POST(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  if (!hasRole(session, ["Administrator"]) || !isSameOrigin(request)) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }
  resetClearPath();
  return NextResponse.json({ok: true});
}
