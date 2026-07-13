import Database from "better-sqlite3";
import {randomBytes, scryptSync, timingSafeEqual} from "node:crypto";
import fs from "fs";
import path from "path";

export type Row = Record<string, string | number | null>;
let instance: Database.Database | null = null;
export const CLEARPATH_SEED_VERSION="2026.07.12.2";
export type ClearPathSeedSummary = {orders:number; searches:number; users:number};
const configuredDbPath = process.env.CLEARPATH_DB_PATH?.trim();
const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(process.cwd(), "data", "clearpath.sqlite3");

export function hashPassword(password:string){const salt=randomBytes(16).toString("hex");const digest=scryptSync(password,salt,32).toString("hex");return `scrypt$${salt}$${digest}`}
export function verifyPassword(password:string,stored:string){const [scheme,salt,digest]=stored.split("$");if(scheme!=="scrypt"||!salt||!digest)return false;const actual=scryptSync(password,salt,32),expected=Buffer.from(digest,"hex");return actual.length===expected.length&&timingSafeEqual(actual,expected)}

const first = ["Olivia","Marcus","Sofia","Ethan","Priya","Daniel","Maya","Lucas","Grace","Noah","Avery","Caleb","Nina","Jordan","Elena","Miles","Zoe","Andre","Lena","Henry"];
const last = ["Bennett","Chen","Ramirez","Walker","Patel","Kim","Thompson","Brooks","Nguyen","Foster","Reed","Morgan","Diaz","Collins","Shah","Price","Rivera","James","Carter","Ross"];
const clients = [
  ["Northstar Health Partners","Healthcare"],["Apex Staffing Group","Staffing"],["Ironwood Manufacturing","Manufacturing"],["Summit Freight Lines","Transportation"],
  ["Meridian Community Bank","Financial Services"],["Brightwell Consulting","Professional Services"],["Canyon Ridge Senior Living","Healthcare"],["ForgePoint Logistics","Transportation"]
];
const vendors = [
  ["Metro Court Research","County criminal","CO, UT, WY","1.8 days",27,96,1], ["National Records Network","Criminal databases","Nationwide","0.4 days",12,94,1],
  ["VerifyNow Employment Services","Employment","Nationwide","2.6 days",24,92,1], ["Academic Records Direct","Education","Nationwide","3.1 days",29,91,1],
  ["Precision Drug Testing","Drug screening","Nationwide","1.2 days",38,95,0], ["Federal Search Partners","Federal criminal","Nationwide","2.0 days",31,97,1]
];

function schema(db: Database.Database) {
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cp_users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password TEXT,role TEXT,name TEXT);
    CREATE TABLE IF NOT EXISTS cp_clients(id INTEGER PRIMARY KEY,name TEXT,industry TEXT,status TEXT);
    CREATE TABLE IF NOT EXISTS cp_candidates(id INTEGER PRIMARY KEY,name TEXT,dob TEXT,ssn TEXT,email TEXT,phone TEXT,address TEXT,previous_address TEXT,aliases TEXT);
    CREATE TABLE IF NOT EXISTS cp_orders(id INTEGER PRIMARY KEY,order_id TEXT UNIQUE,candidate_id INTEGER,client_id INTEGER,position TEXT,package TEXT,order_date TEXT,target_date TEXT,status TEXT,assigned_to TEXT,aging INTEGER,issue TEXT,priority TEXT,hiring_location TEXT,recruiter TEXT,updated_at TEXT);
    CREATE TABLE IF NOT EXISTS cp_searches(id INTEGER PRIMARY KEY,search_id TEXT UNIQUE,order_id INTEGER,type TEXT,jurisdiction TEXT,vendor TEXT,date_assigned TEXT,due_date TEXT,status TEXT,result TEXT,vendor_cost REAL,court_fee REAL,client_price REAL,notes TEXT,last_activity TEXT,delay_reason TEXT,expected_cost REAL);
    CREATE TABLE IF NOT EXISTS cp_qa(id INTEGER PRIMARY KEY,qa_id TEXT,order_id INTEGER,issue_count INTEGER,priority TEXT,reviewer TEXT,age INTEGER,status TEXT);
    CREATE TABLE IF NOT EXISTS cp_billing(id INTEGER PRIMARY KEY,order_id INTEGER,search_id INTEGER,issue TEXT,vendor_cost REAL,expected_cost REAL,client_price REAL,status TEXT);
    CREATE TABLE IF NOT EXISTS cp_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,user TEXT,role TEXT,action TEXT,entity_type TEXT,entity_id TEXT,previous_value TEXT,new_value TEXT,note TEXT,source TEXT,session_id TEXT);
    CREATE TABLE IF NOT EXISTS cp_reports(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,summary TEXT,highlights TEXT,created_by TEXT,created_at TEXT);
    CREATE TABLE IF NOT EXISTS cp_notes(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,note TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cp_invoices(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_number TEXT UNIQUE,billing_id INTEGER NOT NULL,order_id INTEGER NOT NULL,due_date TEXT NOT NULL,note TEXT,status TEXT NOT NULL,total REAL NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cp_invoice_lines(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_id INTEGER NOT NULL,description TEXT NOT NULL,amount REAL NOT NULL,FOREIGN KEY(invoice_id) REFERENCES cp_invoices(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_vendor_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,vendor_id INTEGER NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,search_id TEXT,follow_up_date TEXT,direction TEXT NOT NULL,status TEXT NOT NULL,sent_by TEXT NOT NULL,sent_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cp_communications(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,search_id TEXT,recipient_type TEXT NOT NULL,recipient TEXT NOT NULL,channel TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,direction TEXT NOT NULL,status TEXT NOT NULL,sent_by TEXT NOT NULL,sent_at TEXT NOT NULL,FOREIGN KEY(order_id) REFERENCES cp_orders(id) ON DELETE CASCADE,FOREIGN KEY(search_id) REFERENCES cp_searches(search_id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS cp_documents(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,search_id TEXT,name TEXT NOT NULL,document_type TEXT NOT NULL,mime_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,storage_reference TEXT,uploaded_by TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(order_id) REFERENCES cp_orders(id) ON DELETE CASCADE,FOREIGN KEY(search_id) REFERENCES cp_searches(search_id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS cp_verification_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,search_id TEXT NOT NULL,attempt_type TEXT NOT NULL,outcome TEXT NOT NULL,next_follow_up TEXT,note TEXT NOT NULL,attempted_by TEXT NOT NULL,attempted_at TEXT NOT NULL,FOREIGN KEY(search_id) REFERENCES cp_searches(search_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_qa_checklist_items(id INTEGER PRIMARY KEY,qa_id INTEGER NOT NULL,item_key TEXT NOT NULL,label TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',updated_by TEXT,updated_at TEXT,UNIQUE(qa_id,item_key),FOREIGN KEY(qa_id) REFERENCES cp_qa(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_criminal_match_reviews(id INTEGER PRIMARY KEY AUTOINCREMENT,search_id TEXT NOT NULL,decision TEXT NOT NULL,comparison_note TEXT NOT NULL,routed_to_compliance INTEGER NOT NULL,reviewed_by TEXT NOT NULL,reviewed_at TEXT NOT NULL,FOREIGN KEY(search_id) REFERENCES cp_searches(search_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_message_templates(id INTEGER PRIMARY KEY,template_key TEXT UNIQUE NOT NULL,audience TEXT NOT NULL,name TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cp_disputes(id INTEGER PRIMARY KEY,dispute_id TEXT UNIQUE NOT NULL,order_id INTEGER NOT NULL,candidate_id INTEGER NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,opened_at TEXT NOT NULL,assigned_to TEXT NOT NULL,FOREIGN KEY(order_id) REFERENCES cp_orders(id),FOREIGN KEY(candidate_id) REFERENCES cp_candidates(id));
    CREATE TABLE IF NOT EXISTS cp_billing_approval_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,billing_id INTEGER NOT NULL,requested_amount REAL NOT NULL,reason TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL,requested_by TEXT NOT NULL,requested_at TEXT NOT NULL,FOREIGN KEY(billing_id) REFERENCES cp_billing(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_candidate_progress(candidate_id INTEGER PRIMARY KEY,personal_status TEXT NOT NULL,address_status TEXT NOT NULL,disclosure_status TEXT NOT NULL,authorization_status TEXT NOT NULL,document_status TEXT NOT NULL,current_step TEXT NOT NULL,disclosure_acknowledged_at TEXT,signature_name TEXT,authorized_at TEXT,updated_by TEXT,updated_at TEXT NOT NULL,FOREIGN KEY(candidate_id) REFERENCES cp_candidates(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS cp_vendors(id INTEGER PRIMARY KEY,name TEXT,coverage TEXT,jurisdictions TEXT,turnaround TEXT,cost REAL,quality INTEGER,preferred INTEGER,status TEXT,contact TEXT);
    CREATE TABLE IF NOT EXISTS cp_meta(key TEXT PRIMARY KEY,value TEXT);
    CREATE INDEX IF NOT EXISTS idx_cp_orders_status ON cp_orders(status);
    CREATE INDEX IF NOT EXISTS idx_cp_orders_candidate ON cp_orders(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_cp_orders_client ON cp_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_cp_searches_order ON cp_searches(order_id);
    CREATE INDEX IF NOT EXISTS idx_cp_searches_status_due ON cp_searches(status,due_date);
    CREATE INDEX IF NOT EXISTS idx_cp_qa_order_status ON cp_qa(order_id,status);
    CREATE INDEX IF NOT EXISTS idx_cp_billing_order_status ON cp_billing(order_id,status);
    CREATE INDEX IF NOT EXISTS idx_cp_audit_entity ON cp_audit(entity_type,entity_id);
    CREATE INDEX IF NOT EXISTS idx_cp_notes_entity ON cp_notes(entity_type,entity_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_cp_invoices_billing ON cp_invoices(billing_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_cp_invoice_lines_invoice ON cp_invoice_lines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_cp_vendor_messages_vendor ON cp_vendor_messages(vendor_id,sent_at);
    CREATE INDEX IF NOT EXISTS idx_cp_vendor_messages_search ON cp_vendor_messages(search_id);
    CREATE INDEX IF NOT EXISTS idx_cp_communications_order ON cp_communications(order_id,sent_at);
    CREATE INDEX IF NOT EXISTS idx_cp_communications_search ON cp_communications(search_id);
    CREATE INDEX IF NOT EXISTS idx_cp_documents_order ON cp_documents(order_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_cp_documents_search ON cp_documents(search_id);
    CREATE INDEX IF NOT EXISTS idx_cp_verification_attempts_search ON cp_verification_attempts(search_id,attempted_at);
    CREATE INDEX IF NOT EXISTS idx_cp_qa_checklist_qa ON cp_qa_checklist_items(qa_id,item_key);
    CREATE INDEX IF NOT EXISTS idx_cp_criminal_reviews_search ON cp_criminal_match_reviews(search_id,reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_cp_disputes_status ON cp_disputes(status);
    CREATE INDEX IF NOT EXISTS idx_cp_billing_approvals_billing ON cp_billing_approval_requests(billing_id,requested_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_vendors_name_unique ON cp_vendors(name COLLATE NOCASE);
  `);
  const userColumns = new Set((db.prepare("PRAGMA table_info(cp_users)").all() as Array<{name:string}>).map(column=>column.name));
  if(!userColumns.has("candidate_id"))db.exec("ALTER TABLE cp_users ADD COLUMN candidate_id INTEGER");
  if(!userColumns.has("client_id"))db.exec("ALTER TABLE cp_users ADD COLUMN client_id INTEGER");
  const orderColumns = new Set((db.prepare("PRAGMA table_info(cp_orders)").all() as Array<{name:string}>).map(column=>column.name));
  if(!orderColumns.has("hiring_location"))db.exec("ALTER TABLE cp_orders ADD COLUMN hiring_location TEXT");
  if(!orderColumns.has("recruiter"))db.exec("ALTER TABLE cp_orders ADD COLUMN recruiter TEXT");
  if(!orderColumns.has("updated_at"))db.exec("ALTER TABLE cp_orders ADD COLUMN updated_at TEXT");
  const qaColumns = new Set((db.prepare("PRAGMA table_info(cp_qa)").all() as Array<{name:string}>).map(column=>column.name));
  if(!qaColumns.has("decision"))db.exec("ALTER TABLE cp_qa ADD COLUMN decision TEXT");
  if(!qaColumns.has("return_reason"))db.exec("ALTER TABLE cp_qa ADD COLUMN return_reason TEXT");
  if(!qaColumns.has("decision_note"))db.exec("ALTER TABLE cp_qa ADD COLUMN decision_note TEXT");
  if(!qaColumns.has("decided_by"))db.exec("ALTER TABLE cp_qa ADD COLUMN decided_by TEXT");
  if(!qaColumns.has("decided_at"))db.exec("ALTER TABLE cp_qa ADD COLUMN decided_at TEXT");
  const billingColumns = new Set((db.prepare("PRAGMA table_info(cp_billing)").all() as Array<{name:string}>).map(column=>column.name));
  if(!billingColumns.has("resolution_note"))db.exec("ALTER TABLE cp_billing ADD COLUMN resolution_note TEXT");
  if(!billingColumns.has("resolved_by"))db.exec("ALTER TABLE cp_billing ADD COLUMN resolved_by TEXT");
  if(!billingColumns.has("resolved_at"))db.exec("ALTER TABLE cp_billing ADD COLUMN resolved_at TEXT");
  db.exec("UPDATE cp_orders SET hiring_location=COALESCE(NULLIF(hiring_location,''),'Denver, CO'),recruiter=COALESCE(NULLIF(recruiter,''),'Alyssa Moore'),updated_at=COALESCE(NULLIF(updated_at,''),order_date || ' 08:00:00')");
}

export function resetClearPath(): ClearPathSeedSummary {
  const db = getClearPath();
  const tx = db.transaction(() => {
    ["cp_invoice_lines","cp_invoices","cp_vendor_messages","cp_communications","cp_documents","cp_verification_attempts","cp_qa_checklist_items","cp_criminal_match_reviews","cp_billing_approval_requests","cp_disputes","cp_message_templates","cp_candidate_progress","cp_users","cp_clients","cp_candidates","cp_orders","cp_searches","cp_qa","cp_billing","cp_audit","cp_reports","cp_notes","cp_vendors","cp_meta"].forEach(t=>db.exec(`DELETE FROM ${t}`));
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('cp_audit','cp_reports','cp_notes','cp_invoices','cp_invoice_lines','cp_vendor_messages','cp_communications','cp_documents','cp_verification_attempts','cp_criminal_match_reviews','cp_billing_approval_requests')");
    const users = [
      ["admin@clearpath.local","Administrator","Morgan Ellis"],["operations@clearpath.local","Operations Specialist","Taylor Reed"],["qa@clearpath.local","QA Reviewer","Jordan Lee"],
      ["client.admin@clearpath.local","Client Administrator","Casey Martin"],["candidate@clearpath.local","Candidate","Alex Parker"],["researcher@clearpath.local","Researcher / Vendor","Jamie Ford"],
      ["billing@clearpath.local","Billing Specialist","Riley Stone"],["compliance@clearpath.local","Compliance Reviewer","Cameron Wells"]
    ];
    const iu=db.prepare("INSERT INTO cp_users(email,password,role,name) VALUES(?,?,?,?)"); users.forEach(u=>iu.run(u[0],hashPassword("demo123"),u[1],u[2]));
    const ic=db.prepare("INSERT INTO cp_clients(name,industry,status) VALUES(?,?,?)"); clients.forEach(c=>ic.run(c[0],c[1],"Active"));
    const iv=db.prepare("INSERT INTO cp_vendors(name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact) VALUES(?,?,?,?,?,?,?,'Active',?)"); vendors.forEach((v,i)=>iv.run(...v,`ops${i+1}@vendor.example`));
    const templates=[
      ["candidate_missing_authorization","Candidate","Missing authorization request","Action required: complete your screening authorization","Hello {{candidateName}}, please sign in to complete the authorization required for your {{clientName}} background screening."],
      ["candidate_verification_assistance","Candidate","Verification assistance request","Information needed for your verification","Hello {{candidateName}}, we need additional employer or school contact information to complete your screening."],
      ["candidate_missing_information","Candidate","Missing information request","Additional screening information needed","Hello {{candidateName}}, please provide the missing information shown in your candidate portal so we can continue your screening."],
      ["client_fee_approval","Client","Additional fee approval","Approval requested for an additional screening fee","Please review and approve the documented additional screening fee for order {{orderId}}."],
    ];
    const it=db.prepare("INSERT INTO cp_message_templates(template_key,audience,name,subject,body,status) VALUES(?,?,?,?,?,'Active')");templates.forEach(template=>it.run(...template));
    const cand=db.prepare("INSERT INTO cp_candidates(name,dob,ssn,email,phone,address,previous_address,aliases) VALUES(?,?,?,?,?,?,?,?)");
    for(let i=0;i<40;i++) cand.run(`${first[i%20]} ${last[(i*3)%20]}`,`19${78+i%20}-${String(i%9+1).padStart(2,"0")}-${String(i%25+1).padStart(2,"0")}`,`***-**-${String(1200+i).slice(-4)}`,`${first[i%20].toLowerCase()}.${last[(i*3)%20].toLowerCase()}@example.com`,`(303) 555-${String(2100+i)}`,`${140+i} Aspen Way, Denver, CO`,`${80+i} Market St, Aurora, CO`,i%9===0?`${first[i%20]} ${last[(i*3+1)%20]}`:"None reported");
    db.prepare("UPDATE cp_candidates SET name='Alex Parker',email='candidate@clearpath.local',phone='(303) 555-2108',aliases='None reported' WHERE id=9").run();
    db.prepare("UPDATE cp_users SET candidate_id=9 WHERE role='Candidate'").run();
    db.prepare("UPDATE cp_users SET client_id=1 WHERE role='Client Administrator'").run();
    const progress=db.prepare("INSERT INTO cp_candidate_progress(candidate_id,personal_status,address_status,disclosure_status,authorization_status,document_status,current_step,updated_by,updated_at) VALUES(?,? ,?,'Not Started','Not Started','Not Started','Disclosure Review','Seed Setup','2026-07-12 08:00:00')");
    for(let i=1;i<=40;i++)progress.run(i,"Complete","Complete");
    const statuses=["Candidate Action Required","In Progress","Quality Review","Complete","Client Action Required","In Progress","In Progress","On Hold","Complete","In Progress"];
    const packages=["Basic","Standard","Professional","Healthcare"];
    const positions=["Registered Nurse","Warehouse Supervisor","Senior Accountant","Delivery Driver","Software Engineer","Medical Assistant","Operations Manager","Financial Analyst"];
    const issues=["Missing candidate authorization","County search overdue","Possible criminal record match","Employment verification needs follow-up","Client approval required for additional fee","Duplicate order suspected","Invoice fee discrepancy",""];
    const ord=db.prepare("INSERT INTO cp_orders(order_id,candidate_id,client_id,position,package,order_date,target_date,status,assigned_to,aging,issue,priority,hiring_location,recruiter,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for(let i=1;i<=50;i++) { const orderDate=`2026-07-${String(Math.max(1,12-(i%9))).padStart(2,"0")}`; ord.run(`CP-2026-${String(1000+i)}`,((i-1)%40)+1,((i-1)%8)+1,positions[i%8],packages[i%4],orderDate,`2026-07-${String(13+(i%8)).padStart(2,"0")}`,statuses[i%10],i%4===0?"Unassigned":["Taylor Reed","Jamie Ford","Riley Stone"][i%3],i%11,issues[i%8],i%7===0?"Urgent":i%3===0?"High":"Normal",["Denver, CO","Aurora, CO","Lakewood, CO","Colorado Springs, CO"][i%4],["Alyssa Moore","Derek Lewis","Samira Patel"][i%3],`${orderDate} 08:00:00`); }
    db.prepare("UPDATE cp_orders SET status='Candidate Action Required' WHERE id=5").run();
    db.prepare("UPDATE cp_orders SET status='Complete' WHERE id IN (6,9)").run();
    const types=["Social Security Number Trace","County Criminal Search","National Criminal Database","Employment Verification","Education Verification","Motor Vehicle Record","Drug Screening","Healthcare Sanctions Search","Professional License Verification"];
    const s=db.prepare("INSERT INTO cp_searches(search_id,order_id,type,jurisdiction,vendor,date_assigned,due_date,status,result,vendor_cost,court_fee,client_price,notes,last_activity,delay_reason,expected_cost) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for(let i=1;i<=150;i++) { const overdue=i<=8; const unassigned=i>8&&i<=18; const possible=i>=19&&i<=21; const complete=i>21&&i%4===0; const searchType=i===21?"County Criminal Search":types[i%9]; s.run(`SRC-${String(5000+i)}`,((i-1)%50)+1,searchType,["Denver County, CO","Cook County, IL","Nationwide","Maricopa County, AZ","State of Texas"][i%5],unassigned?"Unassigned":vendors[i%6][0],unassigned?null:"2026-07-08",overdue?"2026-07-09":`2026-07-${String(14+i%7).padStart(2,"0")}`,possible?"Possible Record":unassigned?"Not Started":complete?"Completed":overdue?"Awaiting Vendor":"In Progress",possible?"Potential name and DOB match":complete?"No Record Found":"Pending",i%5===0?42:27,i%7===0?8:0,65,possible?"Disposition document attached":"",overdue?"Vendor contacted 07/10":"Updated 07/11",overdue?"Court backlog":"",27); }
    const pendingQaOrderIds=[1,2,4,7,11,12,14,17,21,22];
    const markQualityReview=db.prepare("UPDATE cp_orders SET status='Quality Review' WHERE id=?");
    pendingQaOrderIds.forEach(orderId=>markQualityReview.run(orderId));
    const qa=db.prepare("INSERT INTO cp_qa(qa_id,order_id,issue_count,priority,reviewer,age,status) VALUES(?,?,?,?,?,?,?)"); pendingQaOrderIds.forEach((orderId,i)=>qa.run(`QA-${801+i}`,orderId,i%4,i<2?"High":"Normal",i%3===0?"Jordan Lee":"Unassigned",i+1,"Pending Review"));
    const approvedQa=db.prepare("INSERT INTO cp_qa(qa_id,order_id,issue_count,priority,reviewer,age,status,decision,decision_note,decided_by,decided_at) VALUES(?,?,0,?, 'Jordan Lee',0,'Approved','Approve','Seeded QA approval complete.','Jordan Lee','2026-07-12 10:00:00')");
    const completedOrders=db.prepare("SELECT id,priority FROM cp_orders WHERE status='Complete' ORDER BY id").all() as Array<{id:number;priority:string}>;
    completedOrders.forEach((order,index)=>approvedQa.run(`QA-${901+index}`,order.id,order.priority));
    const checklistItems=[
      ["candidate_authorization","Candidate authorization present"],["required_searches","Required searches completed"],["candidate_identifiers","Candidate identifiers match"],["supporting_documents","Required supporting documents attached"],["record_disposition","Record disposition complete"],["search_results","Search results entered"],["client_requirements","Client-specific requirements met"],["unresolved_hold","No unresolved hold"],["unresolved_dispute","No unresolved dispute"],["billing_complete","Billing items complete"],["report_formatting","Report content formatted correctly"],
    ];
    const checklist=db.prepare("INSERT INTO cp_qa_checklist_items(qa_id,item_key,label,completed,note,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)");
    const qaRows=db.prepare("SELECT id,status FROM cp_qa ORDER BY id").all() as Array<{id:number;status:string}>;
    qaRows.forEach((qaRow,qaIndex)=>checklistItems.forEach((item,itemIndex)=>{const completed=qaRow.status==="Approved"||itemIndex<4;checklist.run(qaRow.id,item[0],item[1],completed?1:0,"",completed?qaRow.status==="Approved"?"Jordan Lee":"Seed Setup":null,completed?`2026-07-${String(8+qaIndex%4).padStart(2,"0")} 09:00:00`:null)}));
    const bill=db.prepare("INSERT INTO cp_billing(order_id,search_id,issue,vendor_cost,expected_cost,client_price,status) VALUES(?,?,?,?,?,?,?)"); ["Vendor fee higher than expected","Search cancelled but still billed","Court access fee not added to invoice","Duplicate vendor fee entered","Client approval required for fee over $50"].forEach((x,i)=>bill.run(10+i,5+i,x,i===0?42:27,27,65,"Open"));
    const dispute=db.prepare("INSERT INTO cp_disputes(dispute_id,order_id,candidate_id,reason,status,opened_at,assigned_to) VALUES(?,?,?,?,?,?,?)");
    dispute.run("DSP-2026-0001",8,8,"Candidate disputes employment date discrepancy","Open","2026-07-10 13:20:00","Cameron Wells");
    dispute.run("DSP-2026-0002",18,18,"Candidate disputes criminal record identity match","Investigating","2026-07-11 10:05:00","Cameron Wells");
    const audit=db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    const actions=["Status changed","Candidate reminder sent","Vendor assigned","Court fee added","Search sent to QA","QA checklist reviewed","Follow-up date updated","Note added"];
    for(let i=0;i<112;i++) audit.run(`2026-07-${String(1+i%12).padStart(2,"0")} ${String(8+i%9).padStart(2,"0")}:${String(i%60).padStart(2,"0")}:00`,users[i%8][2],users[i%8][1],actions[i%8],i%2?"Order":"Search",i%2?`CP-2026-${1001+i%50}`:`SRC-${5001+i%150}`,"Pending",i%3?"In Progress":"Completed","Seeded operational activity","Web",`DEMO-${100+i%9}`);
    db.prepare("INSERT INTO cp_meta(key,value) VALUES('seed_version',?)").run(CLEARPATH_SEED_VERSION);
    const counts=db.prepare(`SELECT
      (SELECT COUNT(*) FROM cp_orders) orders,
      (SELECT COUNT(*) FROM cp_searches) searches,
      (SELECT COUNT(*) FROM cp_users) users`).get() as ClearPathSeedSummary;
    return {orders:Number(counts.orders),searches:Number(counts.searches),users:Number(counts.users)};
  }); return tx();
}

export function getClearPath(){ if(instance) return instance; fs.mkdirSync(path.dirname(dbPath),{recursive:true}); instance=new Database(dbPath); schema(instance); const row=instance.prepare("SELECT COUNT(*) c FROM cp_orders").get() as {c:number},seed=instance.prepare("SELECT value FROM cp_meta WHERE key='seed_version'").get() as {value:string}|undefined; if(!row.c||seed?.value!==CLEARPATH_SEED_VERSION) resetClearPath(); const legacy=instance.prepare("SELECT id,password FROM cp_users WHERE password NOT LIKE 'scrypt$%'").all() as {id:number,password:string}[]; const upgrade=instance.prepare("UPDATE cp_users SET password=? WHERE id=?"); instance.transaction(()=>legacy.forEach(user=>upgrade.run(hashPassword(user.password),user.id)))(); return instance; }
export function rows(sql:string,...args:unknown[]){ return getClearPath().prepare(sql).all(...args) as Row[]; }
export function audit(user:string,role:string,action:string,entityType:string,entityId:string,previousValue="",newValue="",note=""){ getClearPath().prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(user,role,action,entityType,entityId,previousValue,newValue,note,"Web","CURRENT-DEMO"); }

export type ActionActor = {name:string; role:string; sessionId?:string};
export type ActionRequest = {action:string;entityId:string;values?:Record<string,string>;note?:string};
const allowedStatuses = new Set(["Not Started","In Progress","Awaiting Vendor","Quality Review","Completed","Complete","On Hold","Possible Record","Confirmed Match","Possible Match","Non-Match","More Research Required","Duplicate Record","Compliance Review","Resolved","Open","Pending Review","Approved"]);
const clean = (value:unknown, max=500) => typeof value === "string" ? value.trim().slice(0,max) : "";
const field = (values:Record<string,string>, ...names:string[]) => names.map(name=>clean(values[name])).find(Boolean) || "";

/** Applies a supported portal action and its audit record in one SQLite transaction. */
export function applyPortalAction(input:ActionRequest, actor:ActionActor) {
  const db=getClearPath(), action=clean(input.action,120), requestedEntityId=clean(input.entityId,80), note=clean(input.note,2000);
  let entityId=requestedEntityId;
  const values=input.values && typeof input.values === "object" ? input.values : {};
  if(!action || !entityId) throw new Error("Action and entity are required");
  return db.transaction(() => {
    if(entityId==="Selected QA report"){
      const selected=db.prepare("SELECT qa_id FROM cp_qa WHERE status='Pending Review' ORDER BY CASE priority WHEN 'High' THEN 0 ELSE 1 END,age DESC,id LIMIT 1").get() as {qa_id:string}|undefined;
      if(!selected)throw new Error("No pending QA item found");
      entityId=selected.qa_id;
    }
    let entityType="Record", before:Row|undefined, after:Row|undefined, relatedEvidence:Record<string,unknown>={};
    if(entityId.startsWith("SRC-")) {
      entityType="Search";
      before=db.prepare("SELECT search_id,status,vendor,vendor_cost,due_date,notes,last_activity FROM cp_searches WHERE search_id=?").get(entityId) as Row|undefined;
      if(!before) throw new Error("Search not found");
      let status=field(values,"Current Status","New Status","Review Status");
      if(!status && ["Confirmed Match","Possible Match","Non-Match","More Research Required","Duplicate Record"].includes(action)) status=action;
      if(action==="Send to Compliance Review") status="Compliance Review";
      if(status && !allowedStatuses.has(status)) throw new Error("Unsupported status");
      const vendor=field(values,"Approved Vendor") || String(before.vendor||"");
      if(field(values,"Approved Vendor")&&!db.prepare("SELECT 1 FROM cp_vendors WHERE name=? AND status='Active'").get(vendor))throw new Error("Unknown approved vendor");
      const costText=field(values,"Confirmed Vendor Cost"), cost=costText ? Number(costText.replace(/[$,]/g,"")) : Number(before.vendor_cost||0);
      if(!Number.isFinite(cost) || cost<0 || cost>100000) throw new Error("Invalid vendor cost");
      const due=field(values,"Due Date","Follow-Up Date","Expected Completion Date") || String(before.due_date||"");
      if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw new Error("Invalid date");
      const nextNotes=note ? [before.notes,note].filter(Boolean).join("\n") : String(before.notes||"");
      db.prepare("UPDATE cp_searches SET status=?,vendor=?,vendor_cost=?,due_date=?,notes=?,last_activity=datetime('now') WHERE search_id=?").run(status||before.status,vendor,cost,due||null,nextNotes,entityId);
      after=db.prepare("SELECT search_id,status,vendor,vendor_cost,due_date,notes,last_activity FROM cp_searches WHERE search_id=?").get(entityId) as Row;
    } else if(entityId.startsWith("CP-")) {
      entityType="Order";
      before=db.prepare("SELECT id,order_id,status,assigned_to,target_date,issue,priority FROM cp_orders WHERE order_id=?").get(entityId) as Row|undefined;
      if(!before) throw new Error("Order not found");
      let status=field(values,"New Status"); if(action.includes("Send")&&action.includes("QA"))status="Quality Review";if(status==="Completed")status="Complete";
      if(status && !allowedStatuses.has(status)) throw new Error("Unsupported status");
      if(status==="Complete"&&!db.prepare("SELECT 1 FROM cp_qa WHERE order_id=? AND status='Released'").get(before.id))throw new Error("Release the approved QA report before completing this order");
      const selectedReviewer=field(values,"Assigned Reviewer"),assignee=selectedReviewer || String(before.assigned_to||"");
      if(selectedReviewer&&!db.prepare("SELECT 1 FROM cp_users WHERE name=? AND role IN ('QA Reviewer','Administrator')").get(selectedReviewer))throw new Error("Assigned reviewer not found");
      const targetDate=field(values,"Follow-Up Date")||String(before.target_date||"");
      if(targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))throw new Error("Invalid date");
      db.prepare("UPDATE cp_orders SET status=?,assigned_to=?,target_date=?,updated_at=datetime('now') WHERE order_id=?").run(status||before.status,assignee,targetDate||null,entityId);
      if(note)db.prepare("INSERT INTO cp_notes(entity_type,entity_id,note,created_by,created_at) VALUES('Order',?,?,?,datetime('now'))").run(entityId,note,clean(actor.name,100));
      if(action==="Send Order to QA"){
        const existing=db.prepare("SELECT id,qa_id,reviewer,status FROM cp_qa WHERE order_id=? ORDER BY id LIMIT 1").get(before.id) as {id:number;qa_id:string;reviewer:string;status:string}|undefined;
        const reviewer=selectedReviewer||existing?.reviewer||"Unassigned";
        if(existing){
          if(["Approved","Released"].includes(existing.status))throw new Error("Approved or released QA items cannot be resubmitted");
          if(existing.status==="Pending Review")db.prepare("UPDATE cp_qa SET reviewer=? WHERE id=?").run(reviewer,existing.id);
          else{
            db.prepare("UPDATE cp_qa SET reviewer=?,status='Pending Review',decision=NULL,return_reason=NULL,decision_note=NULL,decided_by=NULL,decided_at=NULL WHERE id=?").run(reviewer,existing.id);
            db.prepare("UPDATE cp_qa_checklist_items SET completed=0,note='',updated_by=NULL,updated_at=NULL WHERE qa_id=?").run(existing.id);
          }
        }
        else{
          const maximum=db.prepare("SELECT MAX(CAST(substr(qa_id,4) AS INTEGER)) value FROM cp_qa WHERE qa_id LIKE 'QA-%'").get() as {value:number|null};
          const qaId=`QA-${Math.max(800,Number(maximum.value||0))+1}`;
          const issueCount=(db.prepare("SELECT COUNT(*) count FROM cp_searches WHERE order_id=? AND status NOT IN ('Completed','No Record Found')").get(before.id) as {count:number}).count;
          db.prepare("INSERT INTO cp_qa(qa_id,order_id,issue_count,priority,reviewer,age,status) VALUES(?,?,?,?,?,0,'Pending Review')").run(qaId,before.id,issueCount,before.priority||"Normal",reviewer);
        }
        relatedEvidence.qa=db.prepare("SELECT qa_id qaId,order_id orderId,issue_count issueCount,priority,reviewer,age,status FROM cp_qa WHERE order_id=? ORDER BY id LIMIT 1").get(before.id) as Row;
      }
      after=db.prepare("SELECT order_id,status,assigned_to,target_date,issue FROM cp_orders WHERE order_id=?").get(entityId) as Row;
    } else if(entityId.startsWith("QA-")) {
      entityType="Quality Review";
      before=db.prepare("SELECT qa_id,status,reviewer,issue_count FROM cp_qa WHERE qa_id=?").get(entityId) as Row|undefined;
      if(!before) throw new Error("QA item not found");
      const status=field(values,"Review Status","QA Status") || (action.includes("Approve") ? "Approved" : String(before.status||""));
      if(!allowedStatuses.has(status)) throw new Error("Unsupported status");
      db.prepare("UPDATE cp_qa SET status=? WHERE qa_id=?").run(status,entityId);
      after=db.prepare("SELECT qa_id,status,reviewer,issue_count FROM cp_qa WHERE qa_id=?").get(entityId) as Row;
    } else if(/^\d+$/.test(entityId)) {
      entityType="Billing Exception";
      before=db.prepare("SELECT id,status,vendor_cost,expected_cost,client_price,issue FROM cp_billing WHERE id=?").get(Number(entityId)) as Row|undefined;
      if(!before) throw new Error("Billing exception not found");
      const status=field(values,"Resolution Status") || "Resolved"; if(!allowedStatuses.has(status)) throw new Error("Unsupported status");
      const feeText=field(values,"Corrected Fee"), fee=feeText ? Number(feeText.replace(/[$,]/g,"")) : Number(before.vendor_cost||0);
      if(!Number.isFinite(fee) || fee<0 || fee>100000) throw new Error("Invalid corrected fee");
      db.prepare("UPDATE cp_billing SET status=?,vendor_cost=? WHERE id=?").run(status,fee,Number(entityId));
      after=db.prepare("SELECT id,status,vendor_cost,expected_cost,client_price,issue FROM cp_billing WHERE id=?").get(Number(entityId)) as Row;
    } else throw new Error("Unsupported record identifier");
    const evidence={record:after,submittedFields:values,requestedEntityId,...relatedEvidence};
    db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(clean(actor.name,100),clean(actor.role,100),action,entityType,entityId,JSON.stringify(before),JSON.stringify(evidence),note,"Web",clean(actor.sessionId,100)||"CURRENT-DEMO");
    return {entityType,entityId,before,after};
  })();
}

export type InvoiceLineInput={description:string;amount:number};
export type CreateInvoiceInput={dueDate:string;note:string;lineItems:InvoiceLineInput[]};
export function billingExceptionWithInvoices(id:number){
  const db=getClearPath();
  const exception=db.prepare(`SELECT b.id,b.order_id orderId,o.order_id orderNumber,c.name candidate,cl.name client,b.issue,b.status,b.vendor_cost vendorCost,b.expected_cost expectedCost,b.client_price clientPrice
    FROM cp_billing b JOIN cp_orders o ON o.id=b.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE b.id=?`).get(id) as Row|undefined;
  if(!exception)throw new Error("Billing exception not found");
  const invoiceRows=db.prepare("SELECT id,invoice_number invoiceNumber,billing_id billingId,order_id orderId,due_date dueDate,note,status,total,created_by createdBy,created_at createdAt FROM cp_invoices WHERE billing_id=? ORDER BY id DESC").all(id) as Row[];
  const lineQuery=db.prepare("SELECT id,description,amount FROM cp_invoice_lines WHERE invoice_id=? ORDER BY id");
  return {exception,invoices:invoiceRows.map(invoice=>({...invoice,lineItems:lineQuery.all(invoice.id)}))};
}
export function createInvoice(billingId:number,input:CreateInvoiceInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT id,order_id orderId,status,vendor_cost vendorCost,expected_cost expectedCost,client_price clientPrice,issue FROM cp_billing WHERE id=?").get(billingId) as Row|undefined;
    if(!before)throw new Error("Billing exception not found");
    if(before.status==="Approval Required"||db.prepare("SELECT 1 FROM cp_billing_approval_requests WHERE billing_id=? AND status='Pending'").get(billingId))throw new Error("Resolve the pending client approval before invoicing");
    if(before.status==="Invoiced"||db.prepare("SELECT 1 FROM cp_invoices WHERE billing_id=?").get(billingId))throw new Error("This billing exception is already invoiced");
    const total=Math.round(input.lineItems.reduce((sum,item)=>sum+item.amount,0)*100)/100;
    const result=db.prepare("INSERT INTO cp_invoices(invoice_number,billing_id,order_id,due_date,note,status,total,created_by,created_at) VALUES(NULL,?,?,?,?,?,?,?,datetime('now'))").run(billingId,before.orderId,input.dueDate,input.note,"Open",total,actor.name);
    const invoiceId=Number(result.lastInsertRowid),invoiceNumber=`INV-${new Date().getUTCFullYear()}-${String(invoiceId).padStart(6,"0")}`;
    db.prepare("UPDATE cp_invoices SET invoice_number=? WHERE id=?").run(invoiceNumber,invoiceId);
    const insertLine=db.prepare("INSERT INTO cp_invoice_lines(invoice_id,description,amount) VALUES(?,?,?)");
    input.lineItems.forEach(item=>insertLine.run(invoiceId,item.description,item.amount));
    db.prepare("UPDATE cp_billing SET status='Invoiced' WHERE id=?").run(billingId);
    const invoice=(billingExceptionWithInvoices(billingId).invoices as Array<Row&{lineItems:unknown[]}>).find(row=>row.id===invoiceId)!;
    db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(actor.name,actor.role,"Invoice created","Billing Exception",String(billingId),JSON.stringify(before),JSON.stringify({invoice,billingStatus:"Invoiced"}),input.note,"Web",actor.sessionId||"CURRENT-DEMO");
    return invoice;
  })();
}

export type CreateVendorMessageInput={subject:string;body:string;searchId?:string;followUpDate?:string};
export function vendorWithMessages(id:number){
  const db=getClearPath();
  const vendor=db.prepare("SELECT id,name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact FROM cp_vendors WHERE id=?").get(id) as Row|undefined;
  if(!vendor)throw new Error("Vendor not found");
  const messages=db.prepare("SELECT id,vendor_id vendorId,subject,body,search_id searchId,follow_up_date followUpDate,direction,status,sent_by sentBy,sent_at sentAt FROM cp_vendor_messages WHERE vendor_id=? ORDER BY id DESC").all(id) as Row[];
  return {vendor,messages};
}
export function createVendorMessage(vendorId:number,input:CreateVendorMessageInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const vendor=db.prepare("SELECT id,name,status,contact FROM cp_vendors WHERE id=?").get(vendorId) as Row|undefined;
    if(!vendor)throw new Error("Vendor not found");
    if(vendor.status!=="Active")throw new Error("Vendor is not active");
    if(input.searchId&&!db.prepare("SELECT 1 FROM cp_searches WHERE search_id=? AND vendor=?").get(input.searchId,vendor.name))throw new Error("Search is not assigned to this vendor");
    const result=db.prepare("INSERT INTO cp_vendor_messages(vendor_id,subject,body,search_id,follow_up_date,direction,status,sent_by,sent_at) VALUES(?,?,?,?,?,'Outbound','Sent',?,datetime('now'))").run(vendorId,input.subject,input.body,input.searchId||null,input.followUpDate||null,actor.name);
    const message=db.prepare("SELECT id,vendor_id vendorId,subject,body,search_id searchId,follow_up_date followUpDate,direction,status,sent_by sentBy,sent_at sentAt FROM cp_vendor_messages WHERE id=?").get(result.lastInsertRowid) as Row;
    db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(actor.name,actor.role,"Vendor message sent","Vendor",String(vendorId),"",JSON.stringify({vendor,message}),input.body,"Web",actor.sessionId||"CURRENT-DEMO");
    return message;
  })();
}

export const CLEARPATH_ORDER_STATUSES = ["Draft","Candidate Invited","Candidate Pending","In Progress","Client Action Required","Candidate Action Required","Quality Review","Complete","On Hold","Cancelled","Disputed"] as const;
export const CLEARPATH_SEARCH_STATUSES = ["Not Started","Assigned","In Progress","Awaiting Candidate","Awaiting Client","Awaiting Vendor","Possible Record","No Record Found","Completed","Quality Review","Cancelled","Unable to Complete","Compliance Review"] as const;
export const CLEARPATH_PACKAGES = ["Basic","Standard","Professional","Healthcare"] as const;
export const CLEARPATH_PRIORITIES = ["Normal","High","Urgent"] as const;
export const CLEARPATH_SEARCH_TYPES = ["Social Security Number Trace","County Criminal Search","National Criminal Database","Employment Verification","Education Verification","Motor Vehicle Record","Drug Screening","Healthcare Sanctions Search","Professional License Verification"] as const;

export type CandidateInput={name:string;dob:string;ssn:string;email:string;phone:string;address:string;previousAddress:string;aliases:string};
export type CreateOrderInput={candidateId?:number;candidate?:CandidateInput;clientId:number;position:string;package:string;orderDate:string;targetDate:string;status:string;assignedTo:string;priority:string;issue:string;hiringLocation:string;recruiter:string};
export type UpdateOrderInput=Partial<Pick<CreateOrderInput,"clientId"|"position"|"package"|"targetDate"|"status"|"assignedTo"|"priority"|"issue"|"hiringLocation"|"recruiter">>;
export type UpdateCandidateInput=Partial<CandidateInput>;
export type CreateSearchInput={type:string;jurisdiction:string;vendor:string;dateAssigned?:string;dueDate?:string;status:string;result:string;vendorCost:number;courtFee:number;clientPrice:number;notes:string;delayReason:string;expectedCost:number};
export type UpdateSearchInput=Partial<CreateSearchInput>;
export type CreateCommunicationInput={searchId?:string;recipientType:string;recipient:string;channel:string;subject:string;body:string;direction:string;status:string};
export type CreateDocumentInput={searchId?:string;name:string;documentType:string;mimeType:string;sizeBytes:number;storageReference?:string};
export const CLEARPATH_VERIFICATION_ATTEMPT_TYPES=["Phone","Email","Candidate Assistance"] as const;
export const CLEARPATH_VERIFICATION_OUTCOMES=["No Answer","Left Message","Contacted","Information Requested","Candidate Assistance Requested","Verified","Unable to Verify"] as const;
export const CLEARPATH_QA_DECISIONS=["Approve","Return to Operations","Request Additional Research","Escalate to Compliance","Release Report"] as const;
export const CLEARPATH_QA_RETURN_REASONS=["Missing Document","Incomplete Identifiers","Missing Disposition","Incorrect Status","Incomplete Verification","Duplicate Record","Reportability Review Required"] as const;
export const CLEARPATH_CRIMINAL_REVIEW_DECISIONS=["Confirmed Match","Possible Match","Non-Match","More Research Required","Duplicate Record","Send to Compliance Review"] as const;
export type CreateVerificationAttemptInput={attemptType:string;outcome:string;nextFollowUp?:string;note:string};
export type UpdateQaChecklistInput={items:Array<{key:string;completed:boolean;note:string}>};
export type QaDecisionInput={decision:string;returnReason?:string;note:string};
export type CriminalReviewInput={decision:string;note:string};
export type ResolveBillingInput={correctedFee:number;note:string};
export type CreateBillingApprovalInput={requestedAmount:number;reason:string;note:string};
export type CandidateRequestInput={templateKey:string;followUpDate:string;orderStatus:string;note:string};
export const CLEARPATH_CANDIDATE_STEPS=["Personal Information","Address History","Disclosure Review","Authorization Signature"] as const;
export type CandidatePortalProgressInput={step:string;status:string;personal?:{name?:string;email?:string;phone?:string};address?:{address?:string;previousAddress?:string};acknowledged?:boolean;signatureName?:string};
export type ClientOrderInput={candidate:CandidateInput;position:string;package:string;targetDate:string;priority:string;hiringLocation:string;recruiter:string};
export type VendorInput={name:string;coverage:string;jurisdictions:string;turnaround:string;cost:number;quality:number;preferred:boolean;status:string;contact:string};
export type UpdateVendorInput=Partial<VendorInput>;

const orderRecordSql=`SELECT o.id,o.order_id orderId,o.candidate_id candidateId,o.client_id clientId,c.name candidate,cl.name client,c.email candidateEmail,o.position,o.package,o.order_date orderDate,o.target_date targetDate,o.status,o.assigned_to assignedTo,o.aging,o.issue,o.priority,o.hiring_location hiringLocation,o.recruiter,o.updated_at updatedAt FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE o.order_id=?`;
const candidateRecordSql="SELECT id,name,dob,ssn,email,phone,address,previous_address previousAddress,aliases FROM cp_candidates WHERE id=?";
const searchRecordSql=`SELECT s.id,s.search_id searchId,o.order_id orderId,s.type,s.jurisdiction,s.vendor,s.date_assigned dateAssigned,s.due_date dueDate,s.status,s.result,s.vendor_cost vendorCost,s.court_fee courtFee,s.client_price clientPrice,s.notes,s.last_activity lastActivity,s.delay_reason delayReason,s.expected_cost expectedCost FROM cp_searches s JOIN cp_orders o ON o.id=s.order_id WHERE s.search_id=?`;

function writeDomainAudit(db:Database.Database,actor:ActionActor,action:string,entityType:string,entityId:string,previousValue:unknown,newValue:unknown,note=""){
  db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(clean(actor.name,100),clean(actor.role,100),action,entityType,entityId,previousValue===""?"":JSON.stringify(previousValue),newValue===""?"":JSON.stringify(newValue),clean(note,2000),"Web",clean(actor.sessionId,100)||"CURRENT-DEMO");
}
function orderIdentity(db:Database.Database,orderId:string){
  const order=db.prepare("SELECT id,order_id FROM cp_orders WHERE order_id=?").get(orderId) as {id:number;order_id:string}|undefined;
  if(!order)throw new Error("Order not found");
  return order;
}
function validateClient(db:Database.Database,clientId:number){
  if(!db.prepare("SELECT 1 FROM cp_clients WHERE id=? AND status='Active'").get(clientId))throw new Error("Active client not found");
}
function validateAssignee(db:Database.Database,assignedTo:string){
  if(assignedTo!=="Unassigned"&&!db.prepare("SELECT 1 FROM cp_users WHERE name=?").get(assignedTo))throw new Error("Assigned user not found");
}
function validateVendor(db:Database.Database,vendor:string){
  if(vendor!=="Unassigned"&&!db.prepare("SELECT 1 FROM cp_vendors WHERE name=? AND status='Active'").get(vendor))throw new Error("Active vendor not found");
}
function validateSearchForOrder(db:Database.Database,orderDatabaseId:number,searchId:string|undefined){
  if(searchId&&!db.prepare("SELECT 1 FROM cp_searches WHERE search_id=? AND order_id=?").get(searchId,orderDatabaseId))throw new Error("Search is not part of this order");
}

export function orderByExternalId(orderId:string){
  return getClearPath().prepare(orderRecordSql).get(orderId) as Row|undefined;
}
export function candidateById(candidateId:number){
  return getClearPath().prepare(candidateRecordSql).get(candidateId) as Row|undefined;
}
export function searchByExternalId(searchId:string){
  return getClearPath().prepare(searchRecordSql).get(searchId) as Row|undefined;
}

export function createOrder(input:CreateOrderInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    if(input.targetDate<input.orderDate)throw new Error("Target date cannot be before the order date");
    validateClient(db,input.clientId);
    validateAssignee(db,input.assignedTo);
    let candidateId=input.candidateId;
    if(candidateId){
      if(!db.prepare("SELECT 1 FROM cp_candidates WHERE id=?").get(candidateId))throw new Error("Candidate not found");
    }else if(input.candidate){
      const candidate=input.candidate;
      const inserted=db.prepare("INSERT INTO cp_candidates(name,dob,ssn,email,phone,address,previous_address,aliases) VALUES(?,?,?,?,?,?,?,?)").run(candidate.name,candidate.dob,candidate.ssn,candidate.email,candidate.phone,candidate.address,candidate.previousAddress,candidate.aliases);
      candidateId=Number(inserted.lastInsertRowid);
      const record=db.prepare(candidateRecordSql).get(candidateId) as Row;
      writeDomainAudit(db,actor,"Candidate created","Candidate",String(candidateId),"",{record});
    }else throw new Error("Candidate is required");
    const year=input.orderDate.slice(0,4),prefix=`CP-${year}-`;
    const maximum=db.prepare("SELECT MAX(CAST(substr(order_id,9) AS INTEGER)) value FROM cp_orders WHERE order_id LIKE ?").get(`${prefix}%`) as {value:number|null};
    const orderId=`${prefix}${String(Math.max(1000,Number(maximum.value||0))+1)}`;
    db.prepare("INSERT INTO cp_orders(order_id,candidate_id,client_id,position,package,order_date,target_date,status,assigned_to,aging,issue,priority,hiring_location,recruiter,updated_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,?,datetime('now'))").run(orderId,candidateId,input.clientId,input.position,input.package,input.orderDate,input.targetDate,input.status,input.assignedTo,input.issue,input.priority,input.hiringLocation,input.recruiter);
    const record=db.prepare(orderRecordSql).get(orderId) as Row;
    writeDomainAudit(db,actor,"Order created","Order",orderId,"",{record});
    return record;
  })();
}

export function updateOrder(orderId:string,input:UpdateOrderInput,actor:ActionActor,note=""){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT * FROM cp_orders WHERE order_id=?").get(orderId) as Row|undefined;
    if(!before)throw new Error("Order not found");
    if(input.targetDate!==undefined&&input.targetDate<String(before.order_date))throw new Error("Target date cannot be before the order date");
    if(input.status==="Complete"&&before.status!=="Complete"&&!db.prepare("SELECT 1 FROM cp_qa WHERE order_id=? AND status='Released'").get(before.id))throw new Error("Release the approved QA report before completing this order");
    if(input.clientId!==undefined)validateClient(db,input.clientId);
    if(input.assignedTo!==undefined)validateAssignee(db,input.assignedTo);
    const mapping:Record<keyof UpdateOrderInput,string>={clientId:"client_id",position:"position",package:"package",targetDate:"target_date",status:"status",assignedTo:"assigned_to",priority:"priority",issue:"issue",hiringLocation:"hiring_location",recruiter:"recruiter"};
    const changed:Record<string,string|number>={};
    for(const [key,column] of Object.entries(mapping) as Array<[keyof UpdateOrderInput,string]>){
      const value=input[key];
      if(value!==undefined&&before[column]!==value)changed[column]=value;
    }
    if(!Object.keys(changed).length)throw new Error("No changes submitted");
    const assignments=Object.keys(changed).map(column=>`${column}=?`).join(",");
    db.prepare(`UPDATE cp_orders SET ${assignments},updated_at=datetime('now') WHERE order_id=?`).run(...Object.values(changed),orderId);
    const record=db.prepare(orderRecordSql).get(orderId) as Row;
    writeDomainAudit(db,actor,"Order updated","Order",orderId,before,{record,changedFields:Object.keys(changed)},note);
    return record;
  })();
}

export function updateCandidate(candidateId:number,input:UpdateCandidateInput,actor:ActionActor,note=""){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT * FROM cp_candidates WHERE id=?").get(candidateId) as Row|undefined;
    if(!before)throw new Error("Candidate not found");
    const mapping:Record<keyof UpdateCandidateInput,string>={name:"name",dob:"dob",ssn:"ssn",email:"email",phone:"phone",address:"address",previousAddress:"previous_address",aliases:"aliases"};
    const changed:Record<string,string>={};
    for(const [key,column] of Object.entries(mapping) as Array<[keyof UpdateCandidateInput,string]>){const value=input[key];if(value!==undefined&&before[column]!==value)changed[column]=value;}
    if(!Object.keys(changed).length)throw new Error("No changes submitted");
    const assignments=Object.keys(changed).map(column=>`${column}=?`).join(",");
    db.prepare(`UPDATE cp_candidates SET ${assignments} WHERE id=?`).run(...Object.values(changed),candidateId);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE candidate_id=?").run(candidateId);
    const record=db.prepare(candidateRecordSql).get(candidateId) as Row;
    writeDomainAudit(db,actor,"Candidate updated","Candidate",String(candidateId),before,{record,changedFields:Object.keys(changed)},note);
    return record;
  })();
}

export function createOrderSearch(orderId:string,input:CreateSearchInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const order=orderIdentity(db,orderId);
    validateVendor(db,input.vendor);
    const maximum=db.prepare("SELECT MAX(CAST(substr(search_id,5) AS INTEGER)) value FROM cp_searches WHERE search_id LIKE 'SRC-%'").get() as {value:number|null};
    const searchId=`SRC-${Math.max(5000,Number(maximum.value||0))+1}`;
    db.prepare("INSERT INTO cp_searches(search_id,order_id,type,jurisdiction,vendor,date_assigned,due_date,status,result,vendor_cost,court_fee,client_price,notes,last_activity,delay_reason,expected_cost) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?,?)").run(searchId,order.id,input.type,input.jurisdiction,input.vendor,input.dateAssigned||null,input.dueDate||null,input.status,input.result,input.vendorCost,input.courtFee,input.clientPrice,input.notes,input.delayReason,input.expectedCost);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
    const record=db.prepare(searchRecordSql).get(searchId) as Row;
    writeDomainAudit(db,actor,"Search added","Search",searchId,"",{record,orderId});
    return record;
  })();
}

export function updateSearch(searchId:string,input:UpdateSearchInput,actor:ActionActor,note=""){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT * FROM cp_searches WHERE search_id=?").get(searchId) as Row|undefined;
    if(!before)throw new Error("Search not found");
    if(input.vendor!==undefined)validateVendor(db,input.vendor);
    const mapping:Record<keyof UpdateSearchInput,string>={type:"type",jurisdiction:"jurisdiction",vendor:"vendor",dateAssigned:"date_assigned",dueDate:"due_date",status:"status",result:"result",vendorCost:"vendor_cost",courtFee:"court_fee",clientPrice:"client_price",notes:"notes",delayReason:"delay_reason",expectedCost:"expected_cost"};
    const changed:Record<string,string|number>={};
    for(const [key,column] of Object.entries(mapping) as Array<[keyof UpdateSearchInput,string]>){const value=input[key];if(value!==undefined&&before[column]!==value)changed[column]=value;}
    if(!Object.keys(changed).length)throw new Error("No changes submitted");
    const assignments=Object.keys(changed).map(column=>`${column}=?`).join(",");
    db.prepare(`UPDATE cp_searches SET ${assignments},last_activity=datetime('now') WHERE search_id=?`).run(...Object.values(changed),searchId);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(before.order_id);
    const record=db.prepare(searchRecordSql).get(searchId) as Row;
    writeDomainAudit(db,actor,"Search updated","Search",searchId,before,{record,changedFields:Object.keys(changed)},note);
    return record;
  })();
}

export function orderNotes(orderId:string){
  const db=getClearPath();orderIdentity(db,orderId);
  return db.prepare("SELECT id,entity_id orderId,note,created_by createdBy,created_at createdAt FROM cp_notes WHERE entity_type='Order' AND entity_id=? ORDER BY id DESC").all(orderId) as Row[];
}
export function createOrderNote(orderId:string,note:string,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const order=orderIdentity(db,orderId);
    const result=db.prepare("INSERT INTO cp_notes(entity_type,entity_id,note,created_by,created_at) VALUES('Order',?,?,?,datetime('now'))").run(orderId,note,actor.name);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
    const record=db.prepare("SELECT id,entity_id orderId,note,created_by createdBy,created_at createdAt FROM cp_notes WHERE id=?").get(result.lastInsertRowid) as Row;
    writeDomainAudit(db,actor,"Order note added","Order",orderId,"",{note:record},note);
    return record;
  })();
}

export function orderCommunications(orderId:string){
  const db=getClearPath(),order=orderIdentity(db,orderId);
  return db.prepare("SELECT id,search_id searchId,recipient_type recipientType,recipient,channel,subject,body,direction,status,sent_by sentBy,sent_at sentAt FROM cp_communications WHERE order_id=? ORDER BY id DESC").all(order.id) as Row[];
}
export function createOrderCommunication(orderId:string,input:CreateCommunicationInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const order=orderIdentity(db,orderId);validateSearchForOrder(db,order.id,input.searchId);
    const result=db.prepare("INSERT INTO cp_communications(order_id,search_id,recipient_type,recipient,channel,subject,body,direction,status,sent_by,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'))").run(order.id,input.searchId||null,input.recipientType,input.recipient,input.channel,input.subject,input.body,input.direction,input.status,actor.name);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
    const record=db.prepare("SELECT id,search_id searchId,recipient_type recipientType,recipient,channel,subject,body,direction,status,sent_by sentBy,sent_at sentAt FROM cp_communications WHERE id=?").get(result.lastInsertRowid) as Row;
    writeDomainAudit(db,actor,"Order communication recorded","Order",orderId,"",{communication:record},input.body);
    return record;
  })();
}

export function orderDocuments(orderId:string){
  const db=getClearPath(),order=orderIdentity(db,orderId);
  return db.prepare("SELECT id,search_id searchId,name,document_type documentType,mime_type mimeType,size_bytes sizeBytes,storage_reference storageReference,uploaded_by uploadedBy,created_at createdAt FROM cp_documents WHERE order_id=? ORDER BY id DESC").all(order.id) as Row[];
}
export function createOrderDocument(orderId:string,input:CreateDocumentInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const order=orderIdentity(db,orderId);validateSearchForOrder(db,order.id,input.searchId);
    const result=db.prepare("INSERT INTO cp_documents(order_id,search_id,name,document_type,mime_type,size_bytes,storage_reference,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?,datetime('now'))").run(order.id,input.searchId||null,input.name,input.documentType,input.mimeType,input.sizeBytes,input.storageReference||null,actor.name);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
    const record=db.prepare("SELECT id,search_id searchId,name,document_type documentType,mime_type mimeType,size_bytes sizeBytes,storage_reference storageReference,uploaded_by uploadedBy,created_at createdAt FROM cp_documents WHERE id=?").get(result.lastInsertRowid) as Row;
    writeDomainAudit(db,actor,"Order document recorded","Order",orderId,"",{document:record});
    return record;
  })();
}

function renderTemplate(value:string,context:Record<string,string>){return value.replace(/\{\{([a-zA-Z]+)\}\}/g,(_,key:string)=>context[key]||"")}
function templateByKey(db:Database.Database,key:string){
  const template=db.prepare("SELECT template_key templateKey,audience,name,subject,body,status FROM cp_message_templates WHERE template_key=? AND status='Active'").get(key) as Row|undefined;
  if(!template)throw new Error("Message template not found");
  return template;
}
export function messageTemplates(audience?:string){
  const db=getClearPath();
  return (audience?db.prepare("SELECT template_key templateKey,audience,name,subject,body,status FROM cp_message_templates WHERE status='Active' AND audience=? ORDER BY name").all(audience):db.prepare("SELECT template_key templateKey,audience,name,subject,body,status FROM cp_message_templates WHERE status='Active' ORDER BY audience,name").all()) as Row[];
}

export function verificationAttempts(searchId:string){
  const db=getClearPath();
  if(!db.prepare("SELECT 1 FROM cp_searches WHERE search_id=?").get(searchId))throw new Error("Search not found");
  return db.prepare("SELECT id,search_id searchId,attempt_type attemptType,outcome,next_follow_up nextFollowUp,note,attempted_by attemptedBy,attempted_at attemptedAt FROM cp_verification_attempts WHERE search_id=? ORDER BY id DESC").all(searchId) as Row[];
}
export function createVerificationAttempt(searchId:string,input:CreateVerificationAttemptInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare(`SELECT s.*,o.id order_database_id,o.order_id order_number,c.name candidate_name,c.email candidate_email,cl.name client_name FROM cp_searches s JOIN cp_orders o ON o.id=s.order_id JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE s.search_id=?`).get(searchId) as Row|undefined;
    if(!before)throw new Error("Search not found");
    if(!["Employment Verification","Education Verification"].includes(String(before.type)))throw new Error("Verification attempts require an employment or education search");
    if(["Completed","Unable to Complete","Cancelled"].includes(String(before.status)))throw new Error("Closed verification searches cannot accept new attempts");
    const inserted=db.prepare("INSERT INTO cp_verification_attempts(search_id,attempt_type,outcome,next_follow_up,note,attempted_by,attempted_at) VALUES(?,?,?,?,?,?,datetime('now'))").run(searchId,input.attemptType,input.outcome,input.nextFollowUp||null,input.note,actor.name);
    let status="In Progress";
    if(input.attemptType==="Candidate Assistance")status="Awaiting Candidate";
    if(input.outcome==="Verified")status="Completed";
    if(input.outcome==="Unable to Verify")status="Unable to Complete";
    db.prepare("UPDATE cp_searches SET status=?,result=?,due_date=COALESCE(?,due_date),last_activity=datetime('now') WHERE search_id=?").run(status,input.outcome,input.nextFollowUp||null,searchId);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(before.order_id);
    const attempt=db.prepare("SELECT id,search_id searchId,attempt_type attemptType,outcome,next_follow_up nextFollowUp,note,attempted_by attemptedBy,attempted_at attemptedAt FROM cp_verification_attempts WHERE id=?").get(inserted.lastInsertRowid) as Row;
    let communication:Row|undefined;
    if(input.attemptType==="Candidate Assistance"){
      const template=templateByKey(db,"candidate_verification_assistance"),context={candidateName:String(before.candidate_name),clientName:String(before.client_name),orderId:String(before.order_number)};
      const sent=db.prepare("INSERT INTO cp_communications(order_id,search_id,recipient_type,recipient,channel,subject,body,direction,status,sent_by,sent_at) VALUES(?,?,'Candidate',?,'Portal Message',?,?,'Outbound','Sent',?,datetime('now'))").run(before.order_id,searchId,before.candidate_email,renderTemplate(String(template.subject),context),renderTemplate(String(template.body),context),actor.name);
      communication=db.prepare("SELECT id,search_id searchId,recipient_type recipientType,recipient,channel,subject,body,direction,status,sent_by sentBy,sent_at sentAt FROM cp_communications WHERE id=?").get(sent.lastInsertRowid) as Row;
    }
    const search=db.prepare(searchRecordSql).get(searchId) as Row;
    writeDomainAudit(db,actor,"Verification attempt logged","Search",searchId,before,{attempt,search,...(communication?{communication}:{})},input.note);
    return {attempt,search,communication};
  })();
}

function qaIdentity(db:Database.Database,qaId:string){
  const qa=db.prepare(`SELECT q.id,q.qa_id qaId,q.order_id orderDatabaseId,o.order_id orderId,q.issue_count issueCount,q.priority,q.reviewer,q.age,q.status,q.decision,q.return_reason returnReason,q.decision_note decisionNote,q.decided_by decidedBy,q.decided_at decidedAt FROM cp_qa q JOIN cp_orders o ON o.id=q.order_id WHERE q.qa_id=?`).get(qaId) as Row|undefined;
  if(!qa)throw new Error("QA item not found");
  return qa;
}
function checklistRows(db:Database.Database,qaDatabaseId:number){
  const raw=db.prepare("SELECT item_key key,label,completed,note,updated_by updatedBy,updated_at updatedAt FROM cp_qa_checklist_items WHERE qa_id=? ORDER BY id").all(qaDatabaseId) as Array<{key:string;label:string;completed:number;note:string;updatedBy:string|null;updatedAt:string|null}>;
  return raw.map(item=>({...item,completed:item.completed===1}));
}
export function qaChecklist(qaId:string){const db=getClearPath(),qa=qaIdentity(db,qaId);return {qa,items:checklistRows(db,Number(qa.id))}}
export function updateQaChecklist(qaId:string,input:UpdateQaChecklistInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const qa=qaIdentity(db,qaId);
    if(["Approved","Released"].includes(String(qa.status)))throw new Error("Approved or released QA checklists are locked");
    const before=checklistRows(db,Number(qa.id)),byKey=new Map(before.map(item=>[String(item.key),item]));
    const changed:string[]=[];
    const update=db.prepare("UPDATE cp_qa_checklist_items SET completed=?,note=?,updated_by=?,updated_at=datetime('now') WHERE qa_id=? AND item_key=?");
    for(const item of input.items){const existing=byKey.get(item.key);if(!existing)throw new Error(`Unknown checklist item: ${item.key}`);if(existing.completed!==item.completed||existing.note!==item.note){update.run(item.completed?1:0,item.note,actor.name,qa.id,item.key);changed.push(item.key)}}
    if(!changed.length)throw new Error("No changes submitted");
    const items=checklistRows(db,Number(qa.id));
    writeDomainAudit(db,actor,"QA checklist updated","Quality Review",qaId,before,{items,changedItems:changed});
    return {qa:qaIdentity(db,qaId),items};
  })();
}
export function decideQaItem(qaId:string,input:QaDecisionInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=qaIdentity(db,qaId),items=checklistRows(db,Number(before.id));
    if(before.status==="Released")throw new Error("Released QA items cannot be changed");
    if(["Approve","Release Report"].includes(input.decision)&&(!items.length||items.some(item=>!item.completed)))throw new Error("Complete every QA checklist item before approval or release");
    if(input.decision==="Release Report"&&(before.status!=="Approved"||before.decision!=="Approve"))throw new Error("Approve the QA item before releasing the report");
    if(input.decision==="Approve"&&before.status==="Approved"&&before.decision==="Approve")throw new Error("This QA item is already approved");
    if(before.decision===input.decision&&String(before.returnReason||"")===String(input.returnReason||"")&&String(before.decisionNote||"")===input.note)throw new Error("No changes submitted");
    const qaStatus:Record<string,string>={"Approve":"Approved","Return to Operations":"Returned to Operations","Request Additional Research":"Additional Research","Escalate to Compliance":"Compliance Review","Release Report":"Released"};
    const orderStatus:Record<string,string>={"Approve":"Quality Review","Return to Operations":"In Progress","Request Additional Research":"In Progress","Escalate to Compliance":"Quality Review","Release Report":"Complete"};
    db.prepare("UPDATE cp_qa SET status=?,decision=?,return_reason=?,decision_note=?,decided_by=?,decided_at=datetime('now') WHERE id=?").run(qaStatus[input.decision],input.decision,input.returnReason||null,input.note,actor.name,before.id);
    db.prepare("UPDATE cp_orders SET status=?,updated_at=datetime('now') WHERE id=?").run(orderStatus[input.decision],before.orderDatabaseId);
    const qa=qaIdentity(db,qaId),order=db.prepare(orderRecordSql).get(before.orderId) as Row;
    writeDomainAudit(db,actor,`QA decision: ${input.decision}`,"Quality Review",qaId,before,{qa,order,checklist:items},input.note);
    return {qa,order};
  })();
}

export function createCriminalMatchReview(searchId:string,input:CriminalReviewInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT * FROM cp_searches WHERE search_id=?").get(searchId) as Row|undefined;
    if(!before)throw new Error("Search not found");
    if(!["County Criminal Search","National Criminal Database"].includes(String(before.type)))throw new Error("Criminal review requires a criminal search");
    const latest=db.prepare("SELECT decision FROM cp_criminal_match_reviews WHERE search_id=? ORDER BY id DESC LIMIT 1").get(searchId) as {decision:string}|undefined;
    if(latest?.decision===input.decision)throw new Error("No changes submitted");
    const routed=input.decision==="Send to Compliance Review",status=({"Confirmed Match":"Confirmed Match","Possible Match":"Possible Match","Non-Match":"Completed","More Research Required":"In Progress","Duplicate Record":"Completed","Send to Compliance Review":"Compliance Review"} as Record<string,string>)[input.decision];
    const inserted=db.prepare("INSERT INTO cp_criminal_match_reviews(search_id,decision,comparison_note,routed_to_compliance,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,datetime('now'))").run(searchId,input.decision,input.note,routed?1:0,actor.name);
    db.prepare("UPDATE cp_searches SET status=?,result=?,last_activity=datetime('now') WHERE search_id=?").run(status,input.decision,searchId);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(before.order_id);
    const review=db.prepare("SELECT id,search_id searchId,decision,comparison_note comparisonNote,routed_to_compliance routedToCompliance,reviewed_by reviewedBy,reviewed_at reviewedAt FROM cp_criminal_match_reviews WHERE id=?").get(inserted.lastInsertRowid) as Row;
    const search=db.prepare(searchRecordSql).get(searchId) as Row;
    writeDomainAudit(db,actor,"Criminal match review recorded","Search",searchId,before,{review,search},input.note);
    return {review:{...review,routedToCompliance:review.routedToCompliance===1},search};
  })();
}

const billingRecordSql=`SELECT b.id,b.order_id orderDatabaseId,o.order_id orderId,b.search_id searchDatabaseId,s.search_id searchId,b.issue,b.vendor_cost vendorCost,b.expected_cost expectedCost,b.client_price clientPrice,b.status,b.resolution_note resolutionNote,b.resolved_by resolvedBy,b.resolved_at resolvedAt FROM cp_billing b JOIN cp_orders o ON o.id=b.order_id LEFT JOIN cp_searches s ON s.id=b.search_id WHERE b.id=?`;
export function resolveBillingException(billingId:number,input:ResolveBillingInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare(billingRecordSql).get(billingId) as Row|undefined;if(!before)throw new Error("Billing exception not found");
    if(before.status==="Invoiced")throw new Error("Invoiced billing exceptions cannot be changed");
    if(before.status==="Resolved"&&Number(before.vendorCost)===input.correctedFee&&before.resolutionNote===input.note)throw new Error("No changes submitted");
    db.prepare("UPDATE cp_billing SET status='Resolved',vendor_cost=?,resolution_note=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?").run(input.correctedFee,input.note,actor.name,billingId);
    db.prepare("UPDATE cp_billing_approval_requests SET status='Fulfilled' WHERE billing_id=? AND status='Pending'").run(billingId);
    const billing=db.prepare(billingRecordSql).get(billingId) as Row;
    writeDomainAudit(db,actor,"Billing exception resolved","Billing Exception",String(billingId),before,{billing},input.note);
    return billing;
  })();
}
export function requestBillingApproval(billingId:number,input:CreateBillingApprovalInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare(billingRecordSql).get(billingId) as Row|undefined;if(!before)throw new Error("Billing exception not found");
    if(before.status==="Resolved"||before.status==="Invoiced")throw new Error("Closed billing exceptions cannot request approval");
    if(db.prepare("SELECT 1 FROM cp_billing_approval_requests WHERE billing_id=? AND status='Pending'").get(billingId))throw new Error("A billing approval request is already pending");
    const inserted=db.prepare("INSERT INTO cp_billing_approval_requests(billing_id,requested_amount,reason,note,status,requested_by,requested_at) VALUES(?,?,?,?,'Pending',?,datetime('now'))").run(billingId,input.requestedAmount,input.reason,input.note,actor.name);
    db.prepare("UPDATE cp_billing SET status='Approval Required' WHERE id=?").run(billingId);
    const approvalRequest=db.prepare("SELECT id,billing_id billingId,requested_amount requestedAmount,reason,note,status,requested_by requestedBy,requested_at requestedAt FROM cp_billing_approval_requests WHERE id=?").get(inserted.lastInsertRowid) as Row;
    const billing=db.prepare(billingRecordSql).get(billingId) as Row;
    writeDomainAudit(db,actor,"Billing approval requested","Billing Exception",String(billingId),before,{billing,approvalRequest},input.note);
    return {billing,approvalRequest};
  })();
}

export function sendCandidateRequest(orderId:string,input:CandidateRequestInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare(`SELECT o.id,o.order_id orderId,o.status,o.target_date targetDate,c.name candidateName,c.email candidateEmail,cl.name clientName FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id JOIN cp_clients cl ON cl.id=o.client_id WHERE o.order_id=?`).get(orderId) as Row|undefined;
    if(!before)throw new Error("Order not found");
    const template=templateByKey(db,input.templateKey);if(template.audience!=="Candidate")throw new Error("Candidate message template required");
    const context={candidateName:String(before.candidateName),clientName:String(before.clientName),orderId};
    const inserted=db.prepare("INSERT INTO cp_communications(order_id,search_id,recipient_type,recipient,channel,subject,body,direction,status,sent_by,sent_at) VALUES(?,NULL,'Candidate',?,'Portal Message',?,?,'Outbound','Sent',?,datetime('now'))").run(before.id,before.candidateEmail,renderTemplate(String(template.subject),context),renderTemplate(String(template.body),context),actor.name);
    db.prepare("UPDATE cp_orders SET status=?,target_date=?,updated_at=datetime('now') WHERE id=?").run(input.orderStatus,input.followUpDate,before.id);
    const communication=db.prepare("SELECT id,search_id searchId,recipient_type recipientType,recipient,channel,subject,body,direction,status,sent_by sentBy,sent_at sentAt FROM cp_communications WHERE id=?").get(inserted.lastInsertRowid) as Row;
    const order=db.prepare(orderRecordSql).get(orderId) as Row;
    writeDomainAudit(db,actor,"Candidate request sent","Order",orderId,before,{order,communication,templateKey:input.templateKey},input.note);
    return {order,communication};
  })();
}

function portalCandidateIdentity(db:Database.Database,email:string){
  const identity=db.prepare("SELECT u.candidate_id candidateId FROM cp_users u WHERE lower(u.email)=lower(?) AND u.role='Candidate' AND u.candidate_id IS NOT NULL").get(email) as {candidateId:number}|undefined;
  if(!identity)throw new Error("Candidate portal profile not found");
  return identity;
}
function candidateProgressRecord(db:Database.Database,candidateId:number){
  const progress=db.prepare("SELECT candidate_id candidateId,personal_status personalStatus,address_status addressStatus,disclosure_status disclosureStatus,authorization_status authorizationStatus,document_status documentStatus,current_step currentStep,disclosure_acknowledged_at disclosureAcknowledgedAt,signature_name signatureName,authorized_at authorizedAt,updated_by updatedBy,updated_at updatedAt FROM cp_candidate_progress WHERE candidate_id=?").get(candidateId) as Row|undefined;
  if(!progress)throw new Error("Candidate progress not found");
  return progress;
}
export function candidatePortalState(email:string){
  const db=getClearPath(),identity=portalCandidateIdentity(db,email),candidate=db.prepare(candidateRecordSql).get(identity.candidateId) as Row;
  const documents=db.prepare("SELECT d.id,o.order_id orderId,d.search_id searchId,d.name,d.document_type documentType,d.mime_type mimeType,d.size_bytes sizeBytes,d.storage_reference storageReference,d.uploaded_by uploadedBy,d.created_at createdAt FROM cp_documents d JOIN cp_orders o ON o.id=d.order_id WHERE o.candidate_id=? ORDER BY d.id DESC").all(identity.candidateId) as Row[];
  return {candidate,progress:candidateProgressRecord(db,identity.candidateId),documents};
}
export function updateCandidatePortalProgress(email:string,input:CandidatePortalProgressInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const identity=portalCandidateIdentity(db,email),before=candidatePortalState(email),progress=before.progress;
    const prerequisites:Record<string,string[]>={"Personal Information":[],"Address History":["personalStatus"],"Disclosure Review":["personalStatus","addressStatus"],"Authorization Signature":["personalStatus","addressStatus","disclosureStatus"]};
    if(input.status==="Complete"&&prerequisites[input.step].some(property=>progress[property]!=="Complete"))throw new Error("Complete the preceding candidate steps first");
    if(input.step==="Authorization Signature"&&input.status==="Complete"&&!progress.disclosureAcknowledgedAt)throw new Error("Acknowledge the disclosure before signing authorization");
    const candidateChanges:Record<string,string>={};
    if(input.step==="Personal Information"&&input.personal){const mapping={name:"name",email:"email",phone:"phone"} as const;for(const [key,column] of Object.entries(mapping) as Array<[keyof typeof mapping,string]>){const value=input.personal[key];if(value!==undefined&&before.candidate[column]!==value)candidateChanges[column]=value}}
    if(input.step==="Address History"&&input.address){if(input.address.address!==undefined&&before.candidate.address!==input.address.address)candidateChanges.address=input.address.address;if(input.address.previousAddress!==undefined&&before.candidate.previousAddress!==input.address.previousAddress)candidateChanges.previous_address=input.address.previousAddress}
    const statusColumn:Record<string,string>={"Personal Information":"personal_status","Address History":"address_status","Disclosure Review":"disclosure_status","Authorization Signature":"authorization_status"};
    const progressProperty:Record<string,string>={"Personal Information":"personalStatus","Address History":"addressStatus","Disclosure Review":"disclosureStatus","Authorization Signature":"authorizationStatus"};
    const projected={personalStatus:String(progress.personalStatus),addressStatus:String(progress.addressStatus),disclosureStatus:String(progress.disclosureStatus),authorizationStatus:String(progress.authorizationStatus),documentStatus:String(progress.documentStatus)};
    projected[progressProperty[input.step] as keyof typeof projected]=input.status;
    const orderedSteps:Array<[string,keyof typeof projected]>=[["Personal Information","personalStatus"],["Address History","addressStatus"],["Disclosure Review","disclosureStatus"],["Authorization Signature","authorizationStatus"],["Document Upload","documentStatus"]];
    const firstIncomplete=orderedSteps.find(([,property])=>projected[property]!=="Complete")?.[0]||"Complete";
    const currentStep=input.status==="In Progress"?input.step:firstIncomplete;
    const progressChanged=progress[progressProperty[input.step]]!==input.status||progress.currentStep!==currentStep||(input.step==="Disclosure Review"&&input.acknowledged===true&&!progress.disclosureAcknowledgedAt)||(input.step==="Authorization Signature"&&input.signatureName!==undefined&&progress.signatureName!==input.signatureName);
    if(!Object.keys(candidateChanges).length&&!progressChanged)throw new Error("No changes submitted");
    if(Object.keys(candidateChanges).length){const assignments=Object.keys(candidateChanges).map(column=>`${column}=?`).join(",");db.prepare(`UPDATE cp_candidates SET ${assignments} WHERE id=?`).run(...Object.values(candidateChanges),identity.candidateId)}
    const extraAssignments:string[]=[];const extraValues:unknown[]=[];
    if(input.step==="Disclosure Review"&&input.acknowledged===true){extraAssignments.push("disclosure_acknowledged_at=COALESCE(disclosure_acknowledged_at,datetime('now'))")}
    if(input.step==="Authorization Signature"&&input.signatureName!==undefined){extraAssignments.push("signature_name=?","authorized_at=datetime('now')");extraValues.push(input.signatureName)}
    db.prepare(`UPDATE cp_candidate_progress SET ${statusColumn[input.step]}=?,current_step=?,${extraAssignments.length?`${extraAssignments.join(",")},`:""}updated_by=?,updated_at=datetime('now') WHERE candidate_id=?`).run(input.status,currentStep,...extraValues,actor.name,identity.candidateId);
    const state=candidatePortalState(email);
    writeDomainAudit(db,actor,`Candidate portal step saved: ${input.step}`,"Candidate",String(identity.candidateId),before,{candidate:state.candidate,progress:state.progress,changedCandidateFields:Object.keys(candidateChanges)});
    return state;
  })();
}
export function recordCandidatePortalDocument(email:string,input:CreateDocumentInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    const identity=portalCandidateIdentity(db,email),order=db.prepare("SELECT id,order_id FROM cp_orders WHERE candidate_id=? ORDER BY CASE status WHEN 'Complete' THEN 1 ELSE 0 END,id DESC LIMIT 1").get(identity.candidateId) as {id:number;order_id:string}|undefined;
    if(!order)throw new Error("Candidate order not found");
    const beforeProgress=candidateProgressRecord(db,identity.candidateId);
    if([beforeProgress.personalStatus,beforeProgress.addressStatus,beforeProgress.disclosureStatus,beforeProgress.authorizationStatus].some(status=>status!=="Complete")||!beforeProgress.disclosureAcknowledgedAt||!beforeProgress.signatureName)throw new Error("Complete disclosure and authorization before recording documents");
    if(db.prepare("SELECT 1 FROM cp_documents d JOIN cp_orders o ON o.id=d.order_id WHERE o.candidate_id=? AND lower(d.name)=lower(?) AND d.mime_type=? AND d.size_bytes=?").get(identity.candidateId,input.name,input.mimeType,input.sizeBytes))throw new Error("This candidate document is already recorded");
    const inserted=db.prepare("INSERT INTO cp_documents(order_id,search_id,name,document_type,mime_type,size_bytes,storage_reference,uploaded_by,created_at) VALUES(?,NULL,?,?,?,?,?,?,datetime('now'))").run(order.id,input.name,input.documentType,input.mimeType,input.sizeBytes,input.storageReference||null,actor.name);
    db.prepare("UPDATE cp_candidate_progress SET document_status='Complete',current_step='Complete',updated_by=?,updated_at=datetime('now') WHERE candidate_id=?").run(actor.name,identity.candidateId);
    db.prepare("UPDATE cp_orders SET updated_at=datetime('now') WHERE id=?").run(order.id);
    const document=db.prepare("SELECT id,search_id searchId,name,document_type documentType,mime_type mimeType,size_bytes sizeBytes,storage_reference storageReference,uploaded_by uploadedBy,created_at createdAt FROM cp_documents WHERE id=?").get(inserted.lastInsertRowid) as Row;
    const progress=candidateProgressRecord(db,identity.candidateId);
    writeDomainAudit(db,actor,"Candidate document recorded","Candidate",String(identity.candidateId),"",{document,progress,orderId:order.order_id});
    return {document,progress};
  })();
}

function portalClientIdentity(db:Database.Database,email:string){
  const identity=db.prepare("SELECT u.client_id clientId,cl.name client FROM cp_users u JOIN cp_clients cl ON cl.id=u.client_id WHERE lower(u.email)=lower(?) AND u.role='Client Administrator' AND cl.status='Active'").get(email) as {clientId:number;client:string}|undefined;
  if(!identity)throw new Error("Client portal account not found");
  return identity;
}
export function clientPortalOrders(email:string){
  const db=getClearPath(),identity=portalClientIdentity(db,email);
  const orders=db.prepare(`SELECT o.order_id orderId,c.name candidate,o.position,o.package,o.order_date orderDate,o.target_date targetDate,o.status,o.aging FROM cp_orders o JOIN cp_candidates c ON c.id=o.candidate_id WHERE o.client_id=? ORDER BY o.id DESC`).all(identity.clientId) as Row[];
  return {client:{id:identity.clientId,name:identity.client},orders};
}
export function createClientSubmittedOrder(email:string,input:ClientOrderInput,actor:ActionActor){
  const identity=portalClientIdentity(getClearPath(),email),orderDate=new Date().toISOString().slice(0,10);
  return createOrder({candidate:input.candidate,clientId:identity.clientId,position:input.position,package:input.package,orderDate,targetDate:input.targetDate,status:"Candidate Invited",assignedTo:"Unassigned",priority:input.priority,issue:"",hiringLocation:input.hiringLocation,recruiter:input.recruiter},actor);
}

function vendorRecord(db:Database.Database,id:number){
  const vendor=db.prepare("SELECT id,name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact FROM cp_vendors WHERE id=?").get(id) as {id:number;name:string;coverage:string;jurisdictions:string;turnaround:string;cost:number;quality:number;preferred:number;status:string;contact:string}|undefined;
  return vendor?{...vendor,preferred:vendor.preferred===1}:undefined;
}
export function vendorsList(){
  const db=getClearPath(),ids=db.prepare("SELECT id FROM cp_vendors ORDER BY preferred DESC,name").all() as Array<{id:number}>;
  return ids.map(row=>vendorRecord(db,row.id)!);
}
export function vendorById(vendorId:number){return vendorRecord(getClearPath(),vendorId)}
export function createVendor(input:VendorInput,actor:ActionActor){
  const db=getClearPath();
  return db.transaction(()=>{
    if(db.prepare("SELECT 1 FROM cp_vendors WHERE lower(name)=lower(?)").get(input.name))throw new Error("Vendor name already exists");
    const inserted=db.prepare("INSERT INTO cp_vendors(name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact) VALUES(?,?,?,?,?,?,?,?,?)").run(input.name,input.coverage,input.jurisdictions,input.turnaround,input.cost,input.quality,input.preferred?1:0,input.status,input.contact);
    const vendor=vendorRecord(db,Number(inserted.lastInsertRowid))!;
    writeDomainAudit(db,actor,"Vendor created","Vendor",String(vendor.id),"",{vendor});
    return vendor;
  })();
}
export function updateVendor(vendorId:number,input:UpdateVendorInput,actor:ActionActor,note=""){
  const db=getClearPath();
  return db.transaction(()=>{
    const before=db.prepare("SELECT id,name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact FROM cp_vendors WHERE id=?").get(vendorId) as Row|undefined;if(!before)throw new Error("Vendor not found");
    if(input.name!==undefined&&db.prepare("SELECT 1 FROM cp_vendors WHERE lower(name)=lower(?) AND id!=?").get(input.name,vendorId))throw new Error("Vendor name already exists");
    const mapping:Record<keyof UpdateVendorInput,string>={name:"name",coverage:"coverage",jurisdictions:"jurisdictions",turnaround:"turnaround",cost:"cost",quality:"quality",preferred:"preferred",status:"status",contact:"contact"};
    const changed:Record<string,string|number>={};
    for(const [key,column] of Object.entries(mapping) as Array<[keyof UpdateVendorInput,string]>){const raw=input[key],value=key==="preferred"&&raw!==undefined?(raw?1:0):raw;if(value!==undefined&&before[column]!==value)changed[column]=value as string|number}
    if(!Object.keys(changed).length)throw new Error("No changes submitted");
    const assignments=Object.keys(changed).map(column=>`${column}=?`).join(",");db.prepare(`UPDATE cp_vendors SET ${assignments} WHERE id=?`).run(...Object.values(changed),vendorId);
    const vendor=vendorRecord(db,vendorId)!;
    writeDomainAudit(db,actor,"Vendor updated","Vendor",String(vendorId),before,{vendor,changedFields:Object.keys(changed)},note);
    return vendor;
  })();
}
