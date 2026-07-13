import {cookies} from "next/headers";
import {SESSION_COOKIE,hasRole,verifySessionToken} from "@/lib/auth";
import {rows} from "@/lib/clearpath";
import VendorWorkspace from "./VendorWorkspace";

export default async function VendorsPage(){
  const session=verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const vendors=rows("SELECT id,name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact FROM cp_vendors ORDER BY preferred DESC,name").map(vendor=>({id:Number(vendor.id),name:vendor.name,coverage:vendor.coverage,jurisdictions:vendor.jurisdictions,turnaround:vendor.turnaround,cost:vendor.cost,quality:vendor.quality,preferred:vendor.preferred,status:vendor.status,contact:vendor.contact}));
  return <VendorWorkspace initialVendors={vendors} canManage={hasRole(session,["Administrator","Operations Specialist"])}/>;
}
