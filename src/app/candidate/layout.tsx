import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {SESSION_COOKIE,hasRole,verifySessionToken} from "@/lib/auth";

export default async function CandidateLayout({children}:{children:React.ReactNode}){
  const session=verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if(!hasRole(session,["Candidate"]))redirect("/login");
  return children;
}
