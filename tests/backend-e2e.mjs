import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {fileURLToPath} from "node:url";

const base=(process.env.CLEARPATH_BASE_URL||"http://localhost:3010").replace(/\/$/,"");
const origin=new URL(base).origin;
if(!["localhost","127.0.0.1","::1"].includes(new URL(base).hostname))throw new Error(`Backend tests reset data and are restricted to a local server; received ${base}`);
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
async function request(path,{cookie,method="GET",body,requestOrigin=origin,redirect,extraHeaders={}}={}){
  const headers={...extraHeaders};
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
  await expectStatus("/api/clearpath/login",200,{method:"POST",requestOrigin:"https://clearpath.example",extraHeaders:{"x-forwarded-host":"clearpath.example","x-forwarded-proto":"https"},body:{email:"operations@clearpath.local",password:"demo123",role:"Operations Specialist"}});
  await expectStatus("/api/clearpath/login",401,{method:"POST",body:{email:"operations@clearpath.local",password:"wrong",role:"Operations Specialist"}});

  for(const [key,email,role] of users)sessions[key]=await login(email,role);
  const resetConfirmation={confirmation:"RESTORE_CLEARPATH_DEMO"};
  await expectStatus("/api/demo/reset",200,{method:"POST",cookie:sessions.admin,body:resetConfirmation});

  for(const key of ["admin","operations","qa","researcher","billing","compliance"]){
    const {data}=await expectStatus("/api/clearpath/queue?slug=overdue-searches",200,{cookie:sessions[key]});
    check(Array.isArray(data),`${key} queue response must be an array`);
  }
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",403,{cookie:sessions.client});
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",403,{cookie:sessions.candidate});
  const candidateQueue=await expectStatus("/api/clearpath/queue?slug=candidate-missing-information",200,{cookie:sessions.operations});assert.equal(candidateQueue.data.length,6);assertions++;
  const releaseQueue=await expectStatus("/api/clearpath/queue?slug=reports-ready-to-release",200,{cookie:sessions.qa});assert.equal(releaseQueue.data.length,12);assertions++;
  const recordReviewQueue=await expectStatus("/api/clearpath/queue?slug=record-review",200,{cookie:sessions.compliance});assert.equal(recordReviewQueue.data.length,3);assertions++;
  await expectStatus("/api/clearpath/queue?slug=does-not-exist",404,{cookie:sessions.operations});
  await expectStatus("/app/dashboard",307,{cookie:sessions.client,requestOrigin:null,redirect:"manual"});
  await expectStatus("/candidate/dashboard",307,{cookie:sessions.operations,requestOrigin:null,redirect:"manual"});
  await expectStatus("/client/dashboard",307,{cookie:sessions.candidate,requestOrigin:null,redirect:"manual"});

  const initialAuditId=db.prepare("SELECT max(id) id FROM cp_audit").get().id;
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{action:"Change Order Status",entityId:"CP-2026-1001",values:{"New Status":"In Progress","Follow-Up Date":"2026-07-20"},note:"Order E2E"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{action:"Send Order to QA",entityId:"CP-2026-1001",values:{"Assigned Reviewer":"Jordan Lee"},note:""}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{action:"Send Order to QA",entityId:"CP-2026-1001",values:{"Assigned Reviewer":"Jordan Lee"},note:""}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Assign Vendor",entityId:"SRC-5009",values:{"Approved Vendor":"Metro Court Research","Confirmed Vendor Cost":"31.25","Due Date":"2026-07-21"},note:"Legacy search mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.qa,body:{action:"Quality Review",entityId:"QA-801",values:{"Review Status":"Approved"},note:"Legacy QA mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.billing,body:{action:"Resolve Exception",entityId:"1",values:{"Corrected Fee":"27.50","Resolution Status":"Resolved"},note:"Legacy billing mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.compliance,body:{action:"Confirmed Match",entityId:"SRC-5019",values:{"Review Status":"Confirmed Match"},note:"Legacy criminal mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.researcher,body:{action:"Contact Vendor",entityId:"SRC-5001",values:{"Follow-Up Date":"2026-07-22"},note:"Legacy contact mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.qa,body:{action:"Approve and Release Report",entityId:"Selected QA report",values:{"QA Status":"Approved"},note:"Legacy release mutation must be rejected"}});
  await expectStatus("/api/clearpath/action",200,{method:"POST",cookie:sessions.operations,body:{kind:"report",title:"E2E Operations Report",summary:"Validated operational state.",highlights:"All backend actions exercised."}});
  const invoicePost=await expectStatus("/api/clearpath/billing/2/invoice",201,{method:"POST",cookie:sessions.billing,body:{dueDate:"2026-08-15",note:"Invoice E2E",lineItems:[{description:"County criminal search",amount:27},{description:"Court access fee",amount:8.5}]}});
  check(/^INV-\d{4}-\d{6}$/.test(invoicePost.data.invoice.invoiceNumber),"invoice number shape");
  assert.equal(invoicePost.data.invoice.total,35.5);assertions++;
  assert.equal(invoicePost.data.invoice.lineItems.length,2);assertions++;
  const invoiceGet=await expectStatus("/api/clearpath/billing/2/invoice",200,{cookie:sessions.operations});
  assert.equal(invoiceGet.data.exception.status,"Invoiced");assertions++;
  assert.equal(invoiceGet.data.invoices[0].invoiceNumber,invoicePost.data.invoice.invoiceNumber);assertions++;
  await expectStatus("/api/clearpath/billing/2/invoice",400,{method:"POST",cookie:sessions.billing,body:{dueDate:"2026-08-16",note:"Duplicate invoice",lineItems:[{description:"Duplicate fee",amount:10}]}});
  await expectStatus("/api/clearpath/billing/2/approval-request",400,{method:"POST",cookie:sessions.billing,body:{requestedAmount:10,reason:"Closed item",note:"Must remain invoiced"}});
  await expectStatus("/api/clearpath/billing/2/resolve",400,{method:"POST",cookie:sessions.billing,body:{correctedFee:27,note:"Must remain invoiced"}});
  const messagePost=await expectStatus("/api/clearpath/vendors/2/messages",201,{method:"POST",cookie:sessions.researcher,body:{subject:"Court follow-up",body:"Please provide the pending disposition.",searchId:"SRC-5001",followUpDate:"2026-07-24"}});
  assert.equal(messagePost.data.message.direction,"Outbound");assertions++;
  assert.equal(messagePost.data.message.status,"Sent");assertions++;
  const messageGet=await expectStatus("/api/clearpath/vendors/2/messages",200,{cookie:sessions.compliance});
  assert.equal(messageGet.data.vendor.name,"National Records Network");assertions++;
  assert.equal(messageGet.data.messages[0].subject,"Court follow-up");assertions++;

  assert.deepEqual(db.prepare("SELECT status,target_date FROM cp_orders WHERE order_id='CP-2026-1001'").get(),{status:"Quality Review",target_date:"2026-07-20"});assertions++;
  assert.deepEqual(db.prepare("SELECT count(*) count,status,reviewer FROM cp_qa WHERE order_id=1").get(),{count:1,status:"Pending Review",reviewer:"Jordan Lee"});assertions++;
  assert.equal(db.prepare("SELECT note FROM cp_notes WHERE entity_id='CP-2026-1001'").get().note,"Order E2E");assertions++;
  assert.deepEqual(db.prepare("SELECT vendor,vendor_cost,due_date FROM cp_searches WHERE search_id='SRC-5009'").get(),{vendor:"Unassigned",vendor_cost:27,due_date:"2026-07-16"});assertions++;
  assert.equal(db.prepare("SELECT status FROM cp_qa WHERE qa_id='QA-801'").get().status,"Pending Review");assertions++;
  assert.deepEqual(db.prepare("SELECT status,vendor_cost FROM cp_billing WHERE id=1").get(),{status:"Open",vendor_cost:42});assertions++;
  assert.equal(db.prepare("SELECT created_by FROM cp_reports WHERE title='E2E Operations Report'").get().created_by,"Taylor Reed");assertions++;
  const auditRows=db.prepare("SELECT action,user,role,entity_type,previous_value,new_value FROM cp_audit WHERE id>? ORDER BY id").all(initialAuditId);
  assert.equal(auditRows.length,6);assertions++;
  for(const row of auditRows){check(row.user&&row.role&&row.entity_type,"audit actor/entity required");if(!["Operations report saved","Invoice created","Vendor message sent"].includes(row.action)){check(JSON.parse(row.previous_value),"audit previous snapshot required");const evidence=JSON.parse(row.new_value);check(evidence.record&&evidence.submittedFields,"audit new evidence required")}}
  const invoiceAudit=auditRows.find(row=>row.action==="Invoice created");check(invoiceAudit&&JSON.parse(invoiceAudit.new_value).invoice,"invoice audit evidence required");
  const messageAudit=auditRows.find(row=>row.action==="Vendor message sent");check(messageAudit&&JSON.parse(messageAudit.new_value).message,"vendor message audit evidence required");
  const qaRoutingAudits=auditRows.filter(row=>row.action==="Send Order to QA");assert.equal(qaRoutingAudits.length,2);assertions++;qaRoutingAudits.forEach(row=>check(JSON.parse(row.new_value).qa,"QA routing audit evidence required"));

  const initialDomainAuditId=db.prepare("SELECT max(id) id FROM cp_audit").get().id;
  const orderPost=await expectStatus("/api/clearpath/orders",201,{method:"POST",cookie:sessions.operations,body:{candidate:{name:"E2E Candidate",dob:"1990-02-03",ssn:"4242",email:"e2e.candidate@example.com",phone:"(303) 555-4242",address:"4242 Test Way, Denver, CO",previousAddress:"101 Previous Ave, Aurora, CO",aliases:"E. Candidate"},clientId:1,position:"Implementation Analyst",package:"Professional",orderDate:"2026-07-12",targetDate:"2026-07-19",status:"Draft",assignedTo:"Taylor Reed",priority:"Normal",issue:"",hiringLocation:"Denver, CO",recruiter:"Alyssa Moore"}});
  const createdOrderId=orderPost.data.order.orderId,createdCandidateId=orderPost.data.order.candidateId;
  check(/^CP-2026-\d+$/.test(createdOrderId),"created order identifier");
  assert.equal(orderPost.data.order.candidate,"E2E Candidate");assertions++;
  const orderPatch=await expectStatus(`/api/clearpath/orders/${createdOrderId}`,200,{method:"PATCH",cookie:sessions.operations,body:{status:"In Progress",targetDate:"2026-07-21",priority:"High",hiringLocation:"Boulder, CO",recruiter:"Derek Lewis",note:"Order edit E2E"}});
  assert.equal(orderPatch.data.order.hiringLocation,"Boulder, CO");assertions++;
  assert.equal(orderPatch.data.order.targetDate,"2026-07-21");assertions++;
  await expectStatus(`/api/clearpath/orders/${createdOrderId}`,400,{method:"PATCH",cookie:sessions.operations,body:{targetDate:"2026-01-01",note:"Target date invariant"}});
  await expectStatus(`/api/clearpath/orders/${createdOrderId}`,400,{method:"PATCH",cookie:sessions.operations,body:{status:"Complete",note:"QA release invariant"}});
  await expectStatus(`/api/clearpath/orders/${createdOrderId}`,400,{method:"PATCH",cookie:sessions.operations,body:{hiringLocation:"Boulder, CO"}});
  const orderGet=await expectStatus(`/api/clearpath/orders/${createdOrderId}`,200,{cookie:sessions.qa});
  assert.equal(orderGet.data.order.status,"In Progress");assertions++;
  const candidatePatch=await expectStatus(`/api/clearpath/candidates/${createdCandidateId}`,200,{method:"PATCH",cookie:sessions.operations,body:{phone:"(303) 555-4343",aliases:"E. Candidate; Evelyn Candidate",note:"Candidate edit E2E"}});
  assert.equal(candidatePatch.data.candidate.phone,"(303) 555-4343");assertions++;
  await expectStatus(`/api/clearpath/candidates/${createdCandidateId}`,400,{method:"PATCH",cookie:sessions.operations,body:{phone:"(303) 555-4343"}});
  const searchPost=await expectStatus(`/api/clearpath/orders/${createdOrderId}/searches`,201,{method:"POST",cookie:sessions.operations,body:{type:"Employment Verification",jurisdiction:"Nationwide",vendor:"VerifyNow Employment Services",dateAssigned:"2026-07-12",dueDate:"2026-07-17",status:"Assigned",result:"Pending",vendorCost:24,courtFee:0,clientPrice:65,notes:"Created from order E2E",delayReason:"",expectedCost:24}});
  const createdSearchId=searchPost.data.search.searchId;check(/^SRC-\d+$/.test(createdSearchId),"created search identifier");
  const searchPatch=await expectStatus(`/api/clearpath/searches/${createdSearchId}`,200,{method:"PATCH",cookie:sessions.researcher,body:{status:"In Progress",dueDate:"2026-07-18",result:"Employer contacted",notes:"First verification attempt logged",note:"Search edit E2E"}});
  assert.equal(searchPatch.data.search.result,"Employer contacted");assertions++;
  await expectStatus(`/api/clearpath/searches/${createdSearchId}`,403,{method:"PATCH",cookie:sessions.researcher,body:{vendorCost:99}});
  await expectStatus(`/api/clearpath/searches/${createdSearchId}`,400,{method:"PATCH",cookie:sessions.operations,body:{status:"In Progress"}});
  const notePost=await expectStatus(`/api/clearpath/orders/${createdOrderId}/notes`,201,{method:"POST",cookie:sessions.qa,body:{note:"QA-visible durable order note."}});
  assert.equal(notePost.data.note.createdBy,"Jordan Lee");assertions++;
  const noteGet=await expectStatus(`/api/clearpath/orders/${createdOrderId}/notes`,200,{cookie:sessions.operations});
  assert.equal(noteGet.data.notes[0].note,"QA-visible durable order note.");assertions++;
  const communicationPost=await expectStatus(`/api/clearpath/orders/${createdOrderId}/communications`,201,{method:"POST",cookie:sessions.operations,body:{searchId:createdSearchId,recipientType:"Candidate",recipient:"e2e.candidate@example.com",channel:"Portal Message",subject:"Employment information requested",body:"Please provide the employer contact information.",direction:"Outbound",status:"Sent"}});
  assert.equal(communicationPost.data.communication.status,"Sent");assertions++;
  const communicationGet=await expectStatus(`/api/clearpath/orders/${createdOrderId}/communications`,200,{cookie:sessions.compliance});
  assert.equal(communicationGet.data.communications[0].subject,"Employment information requested");assertions++;
  const documentPost=await expectStatus(`/api/clearpath/orders/${createdOrderId}/documents`,201,{method:"POST",cookie:sessions.qa,body:{searchId:createdSearchId,name:"employment-verification.pdf",documentType:"Verification Evidence",mimeType:"application/pdf",sizeBytes:48211,storageReference:"recorded://e2e/employment-verification.pdf"}});
  assert.equal(documentPost.data.document.documentType,"Verification Evidence");assertions++;
  const documentGet=await expectStatus(`/api/clearpath/orders/${createdOrderId}/documents`,200,{cookie:sessions.operations});
  assert.equal(documentGet.data.documents[0].name,"employment-verification.pdf");assertions++;
  await expectStatus(`/api/clearpath/orders/${createdOrderId}/documents`,400,{method:"POST",cookie:sessions.operations,body:{name:"unsafe.exe",documentType:"Other",mimeType:"application/octet-stream",sizeBytes:10}});
  await expectStatus("/api/clearpath/orders",403,{method:"POST",cookie:sessions.qa,body:{}});
  const domainAudits=db.prepare("SELECT action FROM cp_audit WHERE id>? ORDER BY id").all(initialDomainAuditId).map(row=>row.action);
  assert.deepEqual(domainAudits,["Candidate created","Order created","Order updated","Candidate updated","Search added","Search updated","Order note added","Order communication recorded","Order document recorded"]);assertions++;
  assert.deepEqual(db.prepare("SELECT hiring_location,recruiter FROM cp_orders WHERE order_id=?").get(createdOrderId),{hiring_location:"Boulder, CO",recruiter:"Derek Lewis"});assertions++;

  const initialWorkflowAuditId=db.prepare("SELECT max(id) id FROM cp_audit").get().id;
  const templatesGet=await expectStatus("/api/clearpath/message-templates?audience=Candidate",200,{cookie:sessions.operations});
  assert.equal(templatesGet.data.templates.length,3);assertions++;
  const phoneAttempt=await expectStatus("/api/clearpath/searches/SRC-5003/attempts",201,{method:"POST",cookie:sessions.researcher,body:{attemptType:"Phone",outcome:"Left Message",nextFollowUp:"2026-07-23",note:"Called employer main line and left a callback message."}});
  assert.equal(phoneAttempt.data.search.status,"In Progress");assertions++;
  const assistanceAttempt=await expectStatus("/api/clearpath/searches/SRC-5003/attempts",201,{method:"POST",cookie:sessions.operations,body:{attemptType:"Candidate Assistance",outcome:"Candidate Assistance Requested",nextFollowUp:"2026-07-25",note:"Requested alternate employer contact details from candidate."}});
  assert.equal(assistanceAttempt.data.search.status,"Awaiting Candidate");assertions++;
  assert.equal(assistanceAttempt.data.communication.recipientType,"Candidate");assertions++;
  const attemptsGet=await expectStatus("/api/clearpath/searches/SRC-5003/attempts",200,{cookie:sessions.qa});
  assert.equal(attemptsGet.data.attempts.length,2);assertions++;
  await expectStatus("/api/clearpath/searches/SRC-5003/attempts",403,{method:"POST",cookie:sessions.qa,body:{attemptType:"Email",outcome:"Contacted",nextFollowUp:"2026-07-25",note:"Forbidden role"}});
  const candidateRequest=await expectStatus("/api/clearpath/orders/CP-2026-1002/candidate-request",201,{method:"POST",cookie:sessions.operations,body:{templateKey:"candidate_missing_information",followUpDate:"2026-07-26",orderStatus:"Candidate Action Required",note:"Missing-information queue outreach."}});
  assert.equal(candidateRequest.data.order.status,"Candidate Action Required");assertions++;
  assert.equal(candidateRequest.data.order.targetDate,"2026-07-26");assertions++;
  assert.match(candidateRequest.data.communication.body,/Marcus Walker/);assertions++;
  const checklistGet=await expectStatus("/api/clearpath/qa/QA-803/checklist",200,{cookie:sessions.qa});
  assert.equal(checklistGet.data.items.length,11);assertions++;
  assert.equal(checklistGet.data.items.filter(item=>item.completed).length,4);assertions++;
  await expectStatus("/api/clearpath/qa/QA-803/decision",400,{method:"POST",cookie:sessions.qa,body:{decision:"Release Report",note:"Checklist incomplete"}});
  const completedChecklist=checklistGet.data.items.map(item=>({key:item.key,completed:true,note:"Validated in QA E2E"}));
  const checklistPut=await expectStatus("/api/clearpath/qa/QA-803/checklist",200,{method:"PUT",cookie:sessions.qa,body:{items:completedChecklist}});
  check(checklistPut.data.items.every(item=>item.completed),"every QA checklist item persisted complete");
  await expectStatus("/api/clearpath/qa/QA-803/decision",400,{method:"POST",cookie:sessions.qa,body:{decision:"Release Report",note:"Approval is required before release."}});
  const qaApproval=await expectStatus("/api/clearpath/qa/QA-803/decision",200,{method:"POST",cookie:sessions.qa,body:{decision:"Approve",note:"All procedural checks completed."}});
  assert.equal(qaApproval.data.qa.status,"Approved");assertions++;
  assert.equal(qaApproval.data.order.status,"Quality Review");assertions++;
  await expectStatus("/api/clearpath/qa/QA-803/checklist",400,{method:"PUT",cookie:sessions.qa,body:{items:completedChecklist.map((item,index)=>({...item,completed:index!==0}))}});
  await expectStatus("/api/clearpath/qa/QA-803/decision",400,{method:"POST",cookie:sessions.qa,body:{decision:"Approve",note:"Duplicate approval"}});
  const qaDecision=await expectStatus("/api/clearpath/qa/QA-803/decision",200,{method:"POST",cookie:sessions.qa,body:{decision:"Release Report",note:"Approved report released."}});
  assert.equal(qaDecision.data.qa.status,"Released");assertions++;
  assert.equal(qaDecision.data.order.status,"Complete");assertions++;
  await expectStatus("/api/clearpath/qa/QA-803/decision",400,{method:"POST",cookie:sessions.qa,body:{decision:"Release Report",note:"All procedural checks completed."}});
  await expectStatus("/api/clearpath/qa/QA-803/decision",403,{method:"POST",cookie:sessions.operations,body:{decision:"Approve",note:"Wrong role"}});
  const criminalReview=await expectStatus("/api/clearpath/searches/SRC-5019/criminal-review",201,{method:"POST",cookie:sessions.compliance,body:{decision:"Send to Compliance Review",note:"Identifiers require a reportability determination by Compliance."}});
  assert.equal(criminalReview.data.review.routedToCompliance,true);assertions++;
  assert.equal(criminalReview.data.search.status,"Compliance Review");assertions++;
  await expectStatus("/api/clearpath/searches/SRC-5019/criminal-review",400,{method:"POST",cookie:sessions.compliance,body:{decision:"Send to Compliance Review",note:"Duplicate decision"}});
  const billingApproval=await expectStatus("/api/clearpath/billing/3/approval-request",201,{method:"POST",cookie:sessions.billing,body:{requestedAmount:73,reason:"Court access fee exceeds the configured client threshold",note:"Client approval required before invoicing."}});
  assert.equal(billingApproval.data.billing.status,"Approval Required");assertions++;
  assert.equal(billingApproval.data.approvalRequest.status,"Pending");assertions++;
  await expectStatus("/api/clearpath/billing/3/approval-request",400,{method:"POST",cookie:sessions.billing,body:{requestedAmount:73,reason:"Duplicate request",note:"Should fail"}});
  const billingResolve=await expectStatus("/api/clearpath/billing/3/resolve",200,{method:"POST",cookie:sessions.billing,body:{correctedFee:35,note:"Court fee validated and billing exception resolved."}});
  assert.equal(billingResolve.data.billing.status,"Resolved");assertions++;
  assert.equal(db.prepare("SELECT status FROM cp_billing_approval_requests WHERE billing_id=3").get().status,"Fulfilled");assertions++;
  await expectStatus("/api/clearpath/billing/3/resolve",400,{method:"POST",cookie:sessions.billing,body:{correctedFee:35,note:"Court fee validated and billing exception resolved."}});
  await expectStatus("/api/clearpath/billing/4/resolve",403,{method:"POST",cookie:sessions.researcher,body:{correctedFee:27,note:"Forbidden role"}});
  const workflowAudits=db.prepare("SELECT action FROM cp_audit WHERE id>? ORDER BY id").all(initialWorkflowAuditId).map(row=>row.action);
  assert.deepEqual(workflowAudits,["Verification attempt logged","Verification attempt logged","Candidate request sent","QA checklist updated","QA decision: Approve","QA decision: Release Report","Criminal match review recorded","Billing approval requested","Billing exception resolved"]);assertions++;

  const initialPortalAuditId=db.prepare("SELECT max(id) id FROM cp_audit").get().id;
  const candidateState=await expectStatus("/api/clearpath/candidate/progress",200,{cookie:sessions.candidate});
  assert.equal(candidateState.data.candidate.name,"Alex Parker");assertions++;
  assert.equal(candidateState.data.progress.currentStep,"Disclosure Review");assertions++;
  const disclosureStart=await expectStatus("/api/clearpath/candidate/progress",200,{method:"PATCH",cookie:sessions.candidate,body:{step:"Disclosure Review",status:"In Progress"}});
  assert.equal(disclosureStart.data.progress.disclosureStatus,"In Progress");assertions++;
  await expectStatus("/api/clearpath/candidate/progress",400,{method:"PATCH",cookie:sessions.candidate,body:{step:"Disclosure Review",status:"In Progress"}});
  await expectStatus("/api/clearpath/candidate/progress",400,{method:"PATCH",cookie:sessions.candidate,body:{step:"Authorization Signature",status:"Complete",signatureName:"Alex Parker"}});
  const disclosureComplete=await expectStatus("/api/clearpath/candidate/progress",200,{method:"PATCH",cookie:sessions.candidate,body:{step:"Disclosure Review",status:"Complete",acknowledged:true}});
  assert.equal(disclosureComplete.data.progress.currentStep,"Authorization Signature");assertions++;
  await expectStatus("/api/clearpath/candidate/documents",400,{method:"POST",cookie:sessions.candidate,body:{name:"premature.pdf",documentType:"Candidate Authorization",mimeType:"application/pdf",sizeBytes:100,storageReference:"recorded://candidate/premature.pdf"}});
  const authorizationComplete=await expectStatus("/api/clearpath/candidate/progress",200,{method:"PATCH",cookie:sessions.candidate,body:{step:"Authorization Signature",status:"Complete",signatureName:"Alex Parker"}});
  assert.equal(authorizationComplete.data.progress.authorizationStatus,"Complete");assertions++;
  assert.equal(authorizationComplete.data.progress.signatureName,"Alex Parker");assertions++;
  const candidateDocument=await expectStatus("/api/clearpath/candidate/documents",201,{method:"POST",cookie:sessions.candidate,body:{name:"signed-authorization.pdf",documentType:"Candidate Authorization",mimeType:"application/pdf",sizeBytes:18420,storageReference:"recorded://candidate/signed-authorization.pdf"}});
  assert.equal(candidateDocument.data.progress.documentStatus,"Complete");assertions++;
  await expectStatus("/api/clearpath/candidate/documents",400,{method:"POST",cookie:sessions.candidate,body:{name:"signed-authorization.pdf",documentType:"Candidate Authorization",mimeType:"application/pdf",sizeBytes:18420,storageReference:"recorded://candidate/signed-authorization.pdf"}});
  await expectStatus("/api/clearpath/candidate/progress",403,{cookie:sessions.operations});
  const clientOrders=await expectStatus("/api/clearpath/client/orders",200,{cookie:sessions.client});
  assert.equal(clientOrders.data.client.name,"Northstar Health Partners");assertions++;
  assert.equal(clientOrders.data.orders.length,8);assertions++;
  const clientOrder=await expectStatus("/api/clearpath/client/orders",201,{method:"POST",cookie:sessions.client,body:{candidate:{name:"Client Submitted Candidate",dob:"1992-06-18",ssn:"9876",email:"client.submitted@example.com",phone:"(303) 555-9876",address:"9876 Client Way, Denver, CO",previousAddress:"",aliases:"None reported"},position:"Clinical Coordinator",package:"Healthcare",targetDate:"2026-07-28",priority:"High",hiringLocation:"Denver, CO",recruiter:"Alyssa Moore"}});
  assert.equal(clientOrder.data.order.client,"Northstar Health Partners");assertions++;
  assert.equal(clientOrder.data.order.status,"Candidate Invited");assertions++;
  assert.equal(clientOrder.data.order.assignedTo,"Unassigned");assertions++;
  await expectStatus("/api/clearpath/client/orders",400,{method:"POST",cookie:sessions.client,body:{clientId:2}});
  await expectStatus("/api/clearpath/client/orders",400,{method:"POST",cookie:sessions.client,body:{candidate:{name:"Past Target Candidate",dob:"1992-06-18",ssn:"9876",email:"past.target@example.com",phone:"(303) 555-9876",address:"9876 Client Way, Denver, CO",previousAddress:"",aliases:"None reported"},position:"Clinical Coordinator",package:"Healthcare",targetDate:"2020-01-01",priority:"High",hiringLocation:"Denver, CO",recruiter:"Alyssa Moore"}});
  await expectStatus("/api/clearpath/client/orders",403,{cookie:sessions.operations});
  const vendorPost=await expectStatus("/api/clearpath/vendors",201,{method:"POST",cookie:sessions.operations,body:{name:"Rocky Mountain Verification",coverage:"Employment and education",jurisdictions:"CO, WY, NM",turnaround:"2.1 days",cost:26.5,quality:93,preferred:false,status:"Active",contact:"operations@rockymountain.example"}});
  const createdVendorId=vendorPost.data.vendor.id;assert.equal(vendorPost.data.vendor.preferred,false);assertions++;
  await expectStatus("/api/clearpath/vendors",400,{method:"POST",cookie:sessions.operations,body:{name:"Rocky Mountain Verification",coverage:"Employment",jurisdictions:"CO",turnaround:"2 days",cost:25,quality:90,preferred:false,status:"Active",contact:"duplicate@rockymountain.example"}});
  const vendorPatch=await expectStatus(`/api/clearpath/vendors/${createdVendorId}`,200,{method:"PATCH",cookie:sessions.admin,body:{quality:98,preferred:true,turnaround:"1.6 days",note:"Preferred after quality review."}});
  assert.equal(vendorPatch.data.vendor.quality,98);assertions++;
  assert.equal(vendorPatch.data.vendor.preferred,true);assertions++;
  await expectStatus(`/api/clearpath/vendors/${createdVendorId}`,400,{method:"PATCH",cookie:sessions.admin,body:{quality:98,preferred:true,turnaround:"1.6 days"}});
  await expectStatus("/api/clearpath/vendors",403,{method:"POST",cookie:sessions.qa,body:{}});
  const portalAudits=db.prepare("SELECT action FROM cp_audit WHERE id>? ORDER BY id").all(initialPortalAuditId).map(row=>row.action);
  assert.deepEqual(portalAudits,["Candidate portal step saved: Disclosure Review","Candidate portal step saved: Disclosure Review","Candidate portal step saved: Authorization Signature","Candidate document recorded","Candidate created","Order created","Vendor created","Vendor updated"]);assertions++;

  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Invented"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-5001",values:{"Due Date":"tomorrow"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Assign Vendor",entityId:"SRC-5009",values:{"Approved Vendor":"Unknown Vendor"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Update Search",entityId:"SRC-9999",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.qa,body:{action:"Change Order Status",entityId:"CP-2026-1001",values:{"New Status":"Complete"}}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Change Order Status",entityId:"CP-2026-1001",values:{"New Status":"Complete"},note:"QA release is required"}});
  await expectStatus("/api/clearpath/action",400,{method:"POST",cookie:sessions.operations,body:{action:"Send Order to QA",entityId:"CP-2026-1003",values:{"Assigned Reviewer":"Jordan Lee"},note:"Approved QA cannot be resubmitted"}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.researcher,body:{action:"Resolve Exception",entityId:"1",values:{"Resolution Status":"Resolved"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.client,body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/action",403,{method:"POST",cookie:sessions.operations,requestOrigin:"https://evil.example",body:{action:"Update Search",entityId:"SRC-5001",values:{"New Status":"Completed"}}});
  await expectStatus("/api/clearpath/billing/2/invoice",403,{cookie:sessions.qa});
  await expectStatus("/api/clearpath/billing/2/invoice",403,{method:"POST",cookie:sessions.billing,requestOrigin:"https://evil.example",body:{dueDate:"2026-08-15",note:"",lineItems:[{description:"Fee",amount:10}]}});
  await expectStatus("/api/clearpath/billing/2/invoice",400,{method:"POST",cookie:sessions.billing,body:{dueDate:"not-a-date",note:"",lineItems:[]}});
  await expectStatus("/api/clearpath/vendors/2/messages",403,{cookie:sessions.client});
  await expectStatus("/api/clearpath/vendors/2/messages",400,{method:"POST",cookie:sessions.operations,body:{subject:"Mismatch",body:"Wrong vendor",searchId:"SRC-5002"}});
  await expectStatus("/api/clearpath/vendors/999/messages",404,{cookie:sessions.operations});
  const resetMarker=()=>Number(db.prepare("SELECT count(*) count FROM cp_reports WHERE title='E2E Operations Report'").get().count);
  assert.equal(resetMarker(),1);assertions++;
  await expectStatus("/api/demo/reset",401,{method:"POST",body:resetConfirmation});
  assert.equal(resetMarker(),1);assertions++;
  await expectStatus("/api/demo/reset",400,{method:"POST",cookie:sessions.admin,body:{}});
  assert.equal(resetMarker(),1);assertions++;
  await expectStatus("/api/demo/reset",403,{method:"POST",cookie:sessions.admin,requestOrigin:"https://evil.example",body:resetConfirmation});
  assert.equal(resetMarker(),1);assertions++;
  await expectStatus("/api/demo/reset",403,{method:"POST",cookie:sessions.admin,requestOrigin:null,extraHeaders:{"sec-fetch-site":"cross-site"},body:resetConfirmation});
  assert.equal(resetMarker(),1);assertions++;
  for(const key of ["qa","client","candidate","researcher","billing","compliance"]){
    await expectStatus("/api/demo/reset",403,{method:"POST",cookie:sessions[key],body:resetConfirmation});
    assert.equal(resetMarker(),1);assertions++;
  }
  await expectStatus("/api/demo/reset",405,{cookie:sessions.admin});
  await expectStatus("/api/demo/reset",405,{method:"PUT",cookie:sessions.admin,body:resetConfirmation});
  assert.equal(resetMarker(),1);assertions++;

  const logout=await expectStatus("/api/clearpath/logout",200,{method:"POST",cookie:sessions.operations,body:{}});
  check(/cp_session=;/.test(logout.response.headers.get("set-cookie")||""),"logout must clear session cookie");
  await expectStatus("/api/clearpath/queue?slug=overdue-searches",401);
  const restored=await expectStatus("/api/demo/reset",200,{method:"POST",cookie:sessions.operations,body:resetConfirmation});
  assert.deepEqual(restored.data.counts,{orders:50,searches:150,users:8});assertions++;
  assert.equal(restored.data.seedVersion,"2026.07.12.2");assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_audit").get().count,112);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_reports").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_notes").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_invoices").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_vendor_messages").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_communications").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_documents").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_verification_attempts").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_criminal_match_reviews").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_billing_approval_requests").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_disputes").get().count,2);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_message_templates").get().count,4);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa_checklist_items").get().count,242);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa WHERE status='Pending Review'").get().count,10);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa WHERE status='Approved'").get().count,12);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa pending JOIN cp_qa approved ON approved.order_id=pending.order_id AND approved.status='Approved' WHERE pending.status='Pending Review'").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id WHERE q.status='Pending Review' AND o.status!='Quality Review'").get().count,0);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa WHERE decision IS NOT NULL").get().count,12);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_qa_checklist_items i JOIN cp_qa q ON q.id=i.qa_id WHERE q.status='Approved' AND i.completed=1").get().count,132);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_orders WHERE status='Candidate Action Required'").get().count,6);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_orders WHERE status='Complete'").get().count,12);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_candidate_progress").get().count,40);assertions++;
  assert.deepEqual(db.prepare("SELECT candidate_id,client_id FROM cp_users WHERE email='candidate@clearpath.local' OR email='client.admin@clearpath.local' ORDER BY email").all(),[{candidate_id:9,client_id:null},{candidate_id:null,client_id:1}]);assertions++;
  assert.deepEqual(db.prepare("SELECT disclosure_status,authorization_status,document_status,current_step FROM cp_candidate_progress WHERE candidate_id=9").get(),{disclosure_status:"Not Started",authorization_status:"Not Started",document_status:"Not Started",current_step:"Disclosure Review"});assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_vendors").get().count,6);assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM cp_orders WHERE client_id=1").get().count,7);assertions++;
  assert.equal(db.prepare("SELECT value FROM cp_meta WHERE key='seed_version'").get().value,"2026.07.12.2");assertions++;
  assert.equal(db.prepare("SELECT count(*) count FROM sqlite_sequence WHERE name IN ('cp_invoices','cp_invoice_lines','cp_vendor_messages','cp_communications','cp_documents','cp_verification_attempts','cp_criminal_match_reviews','cp_billing_approval_requests')").get().count,0);assertions++;
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);assertions++;
  console.log(`ClearPath backend E2E passed (${assertions} assertions). Seed data restored.`);
} finally {
  db.close();
}
