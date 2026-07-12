import {NextRequest, NextResponse} from "next/server";
import {createSessionToken, isSameOrigin, setSessionCookie} from "@/lib/auth";
import {getClearPath, verifyPassword} from "@/lib/clearpath";

type LoginBody = {email?: unknown; password?: unknown; role?: unknown};

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Forbidden"}, {status: 403});
  let body: LoginBody;
  try {
    body = await request.json() as LoginBody;
  } catch {
    return NextResponse.json({error: "Invalid request"}, {status: 400});
  }
  if (
    typeof body.email !== "string" || body.email.length > 254 ||
    typeof body.password !== "string" || body.password.length > 128 ||
    typeof body.role !== "string" || body.role.length > 64
  ) return NextResponse.json({error: "Invalid request"}, {status: 400});

  const user = getClearPath().prepare(
    "SELECT email,name,role,password FROM cp_users WHERE lower(email)=lower(?) AND role=?",
  ).get(body.email.trim(), body.role) as {email: string; name: string; role: string; password:string} | undefined;
  if (!user || !verifyPassword(body.password,user.password)) return NextResponse.json({error: "Invalid credentials"}, {status: 401});

  const response = NextResponse.json({ok: true, role: user.role});
  setSessionCookie(response, createSessionToken({email:user.email,name:user.name,role:user.role}));
  response.cookies.delete("cp_user");
  return response;
}
