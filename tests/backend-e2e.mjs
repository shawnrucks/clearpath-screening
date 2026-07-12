import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {fileURLToPath} from "node:url";

const base=(process.env.CLEARPATH_BASE_URL||"http://localhost:3010").replace(/\/$/,"");
const origin=new URL(base).origin;
const db=new Database(fileURLToPath(new URL("../data/clearpath.sqlite3",import.meta.url)),{readonly:true});
const users=[
  ["admin","admin@clearpath.local","Administrator"],
  ["operations","operations@clearpath.local","Operations Specialist"],
  ["qa","qa@clearpath.local","QA Reviewer"],
  ["client","client.admin@clearpath.local","Client Administrator"],
  ["candidate","candidate@clearpath.local","Candidate"],
  ["researcher","researcher@clearpath.local","Researcher / Vendor"],
  ["billing","billing@clearpath.local","Billing Specialist"],
  ["compliance","compliance@clearpath.local","Compliance Reviewer"],
];
const sessions={};
let assertions=0;
function check(value,message){assert.ok(value,message);assertions++}
async function request(path,{cookie,method="GET",body,requestOrigin=origin,redirect}={}){
  const headers={};
  if(body!==undefined)headers["content-type"]="application/json";
  if(cookie)headers.cookie=cookie;
  if(requestOrigin)headers.origin=requestOrigin;
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect});
  const data=await response.json().catch(()=>null);
  return {response,data};
}
async function expectStatus(path,status,options){const result=await request(path,options);assert.equal(result.response.status,status,`${options?.method||"GET"} ${path}: ${JSON.stringify(result.data)}`);assertions++;return result}
async function login(email,role,password="demo123"){
  const result=await expectStatus("/api/clearpath/login",200,{method:"POST",body:{email,password,role}});
  const cookie=result.response.headers.get("set-cookie")?.match(/cp_session=[^;]+/)?.[0];
  check(cookie,"login must set cp_session");return cookie;
}

try{
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",401);
  await expectStatus("/api/clearpath/action",401,{method:"POST",body:{action:"x",entityId:"SRC-5001"}});
  await expectStatus("/api/clearpath/login",403,{method:"POST",requestOrigin:"https://evil.example",body:{email:"operations@clearpath.local",password:"demo123",role:"Operations Specialist"}});
  await expectStatus("/api/clearpath/login",401,{method:"POST",body:{email:"operations@clearpath.local",password:"wrong",role:"Operations Specialist"}});

  for(const [key,email,role] of users)sessions[key]=await login(email,role);
  await expectStatus("/api/demo/reset",200,{method:"POST",cookie:sessions.admin,body:{}});

  for(const key of ["admin","operations","qa","researcher","billing","compliance"]){
    const {data}=await expectStatus("/api/clearpath/queue?slug=overdue-searches",200,{cookie:sessions[key]});
    check(Array.isArray(data),`${key} queue response must be an array`);
  }
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",403,{cookie:sessions.client});
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",403,{cookie:sessions.candidate});
  await expectStatus("/api/clearpath/queue?slug=does-not-exist",404,{cookie:sessions.operations});
  await expectStatus("/app/dashboard",307,{cookie:sessions.client,requestOrigin:null,redirect:"manual"});

  const initialAuditId=db.prepare("SELECT max(id) id FROM cp_audit").get().id;
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{action:"Change Order Status",entityId:"CP-2026-1001",values:{"New Status":"In Progress","Follow-Up Date":"2026-07-20"},note:"Order E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{action:"Assign Vendor",entityId:"SRC-5009",values:{"Approved Vendor":"Metro Court Research","Confirmed Vendor Cost":"31.25","Due Date":"2026-07-21"},note:"Search E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.qa,body:{action:"Quality Review",entityId:"QA-801",values:{"Review Status":"Approved","Return Reason Code":"NONE"},note:"QA E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.billing,body:{action:"Resolve Exception",entityId:"1",values:{"Corrected Fee":"27.50","Resolution Status":"Resolved"},note:"Billing E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.compliance,body:{action:"Confirmed Match",entityId:"SRC-5019",values:{"Review Status":"Confirmed Match"},note:"Compliance E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.researcher,body:{action:"Contact Vendor",entityId:"SRC-5001",values:{"Follow-Up Date":"2026-07-22"},note:"Research E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.qa,body:{action:"Approve and Release Report",entityId:"Selected QA report",values:{"QA Status":"Approved"},note:"Selected QA E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{kind:"report",title:"E2E Operations Report",summary:"Validated operational state.",highlights:"All backend actions exercised."}});
  const invoicePost=await expectStatus("/api/clearpath/billing/2/invoice",201,{method:"POST",cookie:sessions.billing,body:{dueDate:"2026-08-15",note:"Invoice E2E",lineItems:[{description:"County criminal search",amount:27},{description:"Court access fee",amount:8.5}]}});
  check(/^INV-\d{4}-\d{6}$/.test(invoicePost.data.invoice.invoiceNumber),"invoice number shape");
  assert.equal(invoicePost.data.invoice.total,35.5);assertions++;
  assert.equal(invoicePost.data.invoice.lineItems.length,2);assertions++;
  const invoiceGet=await expectStatus("/api/clearpath/billing/2/invoice",200,{cookie:sessions.operations});
  assert.equal(invoiceGet.data.exception.status,"Invoiced");assertions++;
  assert.equal(invoiceGet.data.invoices[0].invoiceNumber,invoicePost.data.invoice.invoiceNumber);assertions++;
  const messagePost=await expectStatus("/api/clearpath/vendors/2/messages",201,{method:"POST",cookie:sessions.researcher,body:{subject:"Court follow-up",body:"Please provide the pending disposition.",searchId:"SRC-5001",followUpDate:"2026-07-24"}});
  assert.equal(messagePost.data.message.direction,"Outbound");assertions++;
  assert.equal(messagePost.data.message.status,"Sent");assertions++;
  const messageGet=await expectStatus("/api/clearpath/vendors/2/messages",200,{cookie:sessions.compliance});
  assert.equal(messageGet.data.vendor.name,"National Records Network");assertions++;
  assert.equal(messageGet.data.messages[0].subject,"Court follow-up");assertions++;

  assert.deepEqual(db.prepare("SELECT status,target_date FROM cp_orders WHERE order_id='CP-2026-1001'").get(),{status:"In Progress",target_date:"2026-07-20"});assertions++;
  assert.equal(db.prepare("SELECT note FROM cp_notes WHERE entity_id='CP-2026-1001'").get().note,"Order E2E");assertions++;
  assert.deepEqual(db.prepare("SELECT vendor,vendor_cost,due_date FROM cp_searches WHERE search_id='SRC-5009'").get(),{vendor:"Metro Court Research",vendor_cost:31.25,due_date:"2026-07-21"});assertions++;
  assert.equal(db.prepare("SELECT status FROM cp_qa WHERE qa_id='QA-801'").get().status,"Approved");assertions++;
  assert.deepEqual(db.prepare("SELECT status,vendor_cost FROM cp_billing WHERE id=1").get(),{status:"Resolved",vendor_cost:27.5});assertions++;
  assert.equal(db.prepare("SELECT created_by FROM cp_reports WHERE title='E2E Operations Report'").get().created_by,"Taylor Reed");assertions++;
  const auditRows=db.prepare("SELECT action,user,role,entity_type,previous_value,new_value FROM cp_audit WHERE id>? ORDER BY id").all(initialAuditId);
  assert.equal(auditRows.length,10);assertions++;
  for(const row of auditRows){check(row.user&&row.role&&row.entity_type,"audit actor/entity required");if(!["Operations report saved","Invoice created","Vendor message sent"].includes(row.action)){check(JSON.parse(row.previous_value),"audit previous snapshot required");const evidence=JSON.parse(row.new_value);check(evidence.record&&evidence.submittedFields,"audit new evidence required")}}
  const invoiceAudit=auditRows.find(row=>row.action==="Invoice created");check(invoiceAudit&&JSON.parse(invoiceAudit.new_value).invoice,"invoice audit evidence required");
  const messageAudit=auditRows.find(row=>row.action==="Vendor message sent");check(messageAudit&&JSON.parse(messageAudit.new_value).message,"vendor message audit evidence required");

  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Invented"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-5001",values:{"Due Date":"tomorrow"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Assign Vendor",entityId:"SRC-5009",values:{"Approved Vendor":"Unknown Vendor"}}});
  await expectStatus("/api/clearpath/action",404,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-9999",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.qa,body:{action:"Change Order Status",entityId:"CP-2026-1001",values:{"New Status":"Complete"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.researcher,body:{action:"Resolve Exception",entityId:"1",values:{"Resolution Status":"Resolved"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.client,body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.operations,requestOrigin:"https://evil.example",body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/billing/2/invoice",403,{cookie:sessions.qa});
  await expectStatus("/api/clearpath/billing/2/invoice",403,{method:"POST",cookie:sessions.billing,requestOrigin:"https://evil.example",body:{dueDate:"2026-08-15",note:"",lineItems:[{description:"Fee",amount:10}]}});
  await expectStatus("/api/clearpath/billing/2/invoice",400,{method:"POST",cookie:sessions.billing,body:{dueDate:"not-a-date",note:"",lineItems:[]}});
  await expectStatus("/api/clearpath/vendors/2/messages",403,{cookie:sessions.client});
  await expectStatus("/api/clearpath/vendors/2/messages",400,{method:"POST",cookie:sessions.operations,body:{subject:"Mismatch",body:"Wrong vendor",searchId:"SRC-5002"}});
  await expectStatus("/api/clearpath/vendors/999/messages",404,{cookie:sessions.operations});
  await expectStatus("/api/demo/reset",403,{method:"POST",cookie:sessions.operations,body:{}});

  const logout=await expectStatus("/api/clearpath/logout",200,{method:"POST",cookie:sessions.operations,body:{}});
  check(/cp_session=;/.test(logout.response.headers.get("set-cookie")||""),"logout must clear session cookie");
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",401);
  await expectStatus("/api/demo/reset",200,{method:"POST",cookie:sessions.admin,body:{}});
  assert.equal(db.prepare("SELECT count(*) count FROM cp_audit").get().count,112);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_reports").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_notes").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_invoices").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_vendor_messages").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM sqlite_sequence WHERE name IN ('cp_invoices','cp_invoice_lines','cp_vendor_messages')").get().count,0);assertions++;
  console.log(`ClearPath backend E2E passed (${assertions} assertions). Seed data restored.`);
} finally {
  db.close();
}
