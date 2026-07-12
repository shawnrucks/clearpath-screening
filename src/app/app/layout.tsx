import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {INTERNAL_ROLES, SESSION_COOKIE, hasRole, verifySessionToken} from "@/lib/auth";
import {Portal} from "@/components/Portal";

export default async function AppLayout({children}: {children: React.ReactNode}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!hasRole(session, INTERNAL_ROLES)) redirect("/login");
  return <Portal user={{name: session!.name, role: session!.role}}>{children}</Portal>;
}
