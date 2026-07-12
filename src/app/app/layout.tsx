import {cookies} from "next/headers"; import {Portal} from "@/components/Portal";
export default async function AppLayout({children}:{children:React.ReactNode}){const raw=(await cookies()).get("cp_user")?.value;let user={name:"Taylor Reed",role:"Operations Specialist"};try{if(raw)user=JSON.parse(raw)}catch{}return <Portal user={user}>{children}</Portal>}
