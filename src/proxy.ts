import {NextRequest, NextResponse} from "next/server";
import {INTERNAL_ROLES, hasRole, sessionFromRequest} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const session = sessionFromRequest(request);
  const path = request.nextUrl.pathname;
  let allowed = false;
  if (path.startsWith("/app/admin")) allowed = hasRole(session, ["Administrator"]);
  else if (path.startsWith("/app")) allowed = hasRole(session, INTERNAL_ROLES);
  if (path.startsWith("/client")) allowed = hasRole(session, ["Client Administrator"]);
  if (path.startsWith("/candidate")) allowed = hasRole(session, ["Candidate"]);
  if (allowed) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

export const config = {matcher: ["/app/:path*", "/client/:path*", "/candidate/:path*"]};
