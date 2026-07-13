import {NextRequest,NextResponse} from "next/server";
import {CLEARPATH_SEARCH_STATUSES,CLEARPATH_SEARCH_TYPES,createOrderSearch} from "@/lib/clearpath";
import {authorize,domainError,hasOnlyKeys,identifier,nonNegativeNumber,objectBody,optionalText,requiredText,validDate} from "../../_shared";

const managers=["Administrator","Operations Specialist"] as const;
const keys=["type","jurisdiction","vendor","dateAssigned","dueDate","status","result","vendorCost","courtFee","clientPrice","notes","delayReason","expectedCost"] as const;

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=authorize(request,managers,true);if("response" in auth)return auth.response;
  const id=identifier((await params).id,/^CP-\d{4}-\d+$/),body=await objectBody(request);if(!id||!body||!hasOnlyKeys(body,keys))return NextResponse.json({error:"Invalid search"},{status:400});
  const type=requiredText(body.type,160),jurisdiction=requiredText(body.jurisdiction,200),vendor=body.vendor===undefined?"Unassigned":requiredText(body.vendor,200),dateAssigned=body.dateAssigned===undefined?undefined:validDate(body.dateAssigned),dueDate=body.dueDate===undefined?undefined:validDate(body.dueDate),status=body.status===undefined?"Not Started":requiredText(body.status,80),result=body.result===undefined?"Pending":optionalText(body.result,1000),vendorCost=body.vendorCost===undefined?0:nonNegativeNumber(body.vendorCost),courtFee=body.courtFee===undefined?0:nonNegativeNumber(body.courtFee),clientPrice=body.clientPrice===undefined?0:nonNegativeNumber(body.clientPrice),notes=body.notes===undefined?"":optionalText(body.notes,2000),delayReason=body.delayReason===undefined?"":optionalText(body.delayReason,500),expectedCost=body.expectedCost===undefined?0:nonNegativeNumber(body.expectedCost);
  if(!type||!jurisdiction||!vendor||body.dateAssigned!==undefined&&!dateAssigned||body.dueDate!==undefined&&!dueDate||!status||result===null||vendorCost===null||courtFee===null||clientPrice===null||notes===null||delayReason===null||expectedCost===null||!CLEARPATH_SEARCH_TYPES.includes(type as typeof CLEARPATH_SEARCH_TYPES[number])||!CLEARPATH_SEARCH_STATUSES.includes(status as typeof CLEARPATH_SEARCH_STATUSES[number]))return NextResponse.json({error:"Invalid search"},{status:400});
  try{
    const search=createOrderSearch(id,{type,jurisdiction,vendor,dateAssigned:dateAssigned||undefined,dueDate:dueDate||undefined,status,result:result||"",vendorCost,courtFee,clientPrice,notes:notes||"",delayReason:delayReason||"",expectedCost},{name:auth.session.name,role:auth.session.role,sessionId:auth.session.email});
    return NextResponse.json({search},{status:201});
  }catch(error){return domainError(error)}
}
