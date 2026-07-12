import Database from "better-sqlite3";
import {randomBytes, scryptSync, timingSafeEqual} from "node:crypto";
import fs from "fs";
import path from "path";

export type Row = Record<string, string | number | null>;
let instance: Database.Database | null = null;
const dbPath = path.join(process.cwd(), "data", "clearpath.sqlite3");

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
    CREATE TABLE IF NOT EXISTS cp_orders(id INTEGER PRIMARY KEY,order_id TEXT UNIQUE,candidate_id INTEGER,client_id INTEGER,position TEXT,package TEXT,order_date TEXT,target_date TEXT,status TEXT,assigned_to TEXT,aging INTEGER,issue TEXT,priority TEXT);
    CREATE TABLE IF NOT EXISTS cp_searches(id INTEGER PRIMARY KEY,search_id TEXT UNIQUE,order_id INTEGER,type TEXT,jurisdiction TEXT,vendor TEXT,date_assigned TEXT,due_date TEXT,status TEXT,result TEXT,vendor_cost REAL,court_fee REAL,client_price REAL,notes TEXT,last_activity TEXT,delay_reason TEXT,expected_cost REAL);
    CREATE TABLE IF NOT EXISTS cp_qa(id INTEGER PRIMARY KEY,qa_id TEXT,order_id INTEGER,issue_count INTEGER,priority TEXT,reviewer TEXT,age INTEGER,status TEXT);
    CREATE TABLE IF NOT EXISTS cp_billing(id INTEGER PRIMARY KEY,order_id INTEGER,search_id INTEGER,issue TEXT,vendor_cost REAL,expected_cost REAL,client_price REAL,status TEXT);
    CREATE TABLE IF NOT EXISTS cp_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,user TEXT,role TEXT,action TEXT,entity_type TEXT,entity_id TEXT,previous_value TEXT,new_value TEXT,note TEXT,source TEXT,session_id TEXT);
    CREATE TABLE IF NOT EXISTS cp_reports(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,summary TEXT,highlights TEXT,created_by TEXT,created_at TEXT);
    CREATE TABLE IF NOT EXISTS cp_notes(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,note TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
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
  `);
}

export function resetClearPath() {
  const db = getClearPath();
  const tx = db.transaction(() => {
    ["cp_users","cp_clients","cp_candidates","cp_orders","cp_searches","cp_qa","cp_billing","cp_audit","cp_reports","cp_notes","cp_vendors","cp_meta"].forEach(t=>db.exec(`DELETE FROM ${t}`));
    const users = [
      ["admin@clearpath.local","Administrator","Morgan Ellis"],["operations@clearpath.local","Operations Specialist","Taylor Reed"],["qa@clearpath.local","QA Reviewer","Jordan Lee"],
      ["client.admin@clearpath.local","Client Administrator","Casey Martin"],["candidate@clearpath.local","Candidate","Alex Parker"],["researcher@clearpath.local","Researcher / Vendor","Jamie Ford"],
      ["billing@clearpath.local","Billing Specialist","Riley Stone"],["compliance@clearpath.local","Compliance Reviewer","Cameron Wells"]
    ];
    const iu=db.prepare("INSERT INTO cp_users(email,password,role,name) VALUES(?,?,?,?)"); users.forEach(u=>iu.run(u[0],hashPassword("demo123"),u[1],u[2]));
    const ic=db.prepare("INSERT INTO cp_clients(name,industry,status) VALUES(?,?,?)"); clients.forEach(c=>ic.run(c[0],c[1],"Active"));
    const iv=db.prepare("INSERT INTO cp_vendors(name,coverage,jurisdictions,turnaround,cost,quality,preferred,status,contact) VALUES(?,?,?,?,?,?,?,'Active',?)"); vendors.forEach((v,i)=>iv.run(...v,`ops${i+1}@vendor.example`));
    const cand=db.prepare("INSERT INTO cp_candidates(name,dob,ssn,email,phone,address,previous_address,aliases) VALUES(?,?,?,?,?,?,?,?)");
    for(let i=0;i<40;i++) cand.run(`${first[i%20]} ${last[(i*3)%20]}`,`19${78+i%20}-${String(i%9+1).padStart(2,"0")}-${String(i%25+1).padStart(2,"0")}`,`***-**-${String(1200+i).slice(-4)}`,`${first[i%20].toLowerCase()}.${last[(i*3)%20].toLowerCase()}@example.com`,`(303) 555-${String(2100+i)}`,`${140+i} Aspen Way, Denver, CO`,`${80+i} Market St, Aurora, CO`,i%9===0?`${first[i%20]} ${last[(i*3+1)%20]}`:"None reported");
    const statuses=["Candidate Action Required","In Progress","Quality Review","Complete","Client Action Required","In Progress","In Progress","On Hold","Complete","In Progress"];
    const packages=["Basic","Standard","Professional","Healthcare"];
    const positions=["Registered Nurse","Warehouse Supervisor","Senior Accountant","Delivery Driver","Software Engineer","Medical Assistant","Operations Manager","Financial Analyst"];
    const issues=["Missing candidate authorization","County search overdue","Possible criminal record match","Employment verification needs follow-up","Client approval required for additional fee","Duplicate order suspected","Invoice fee discrepancy",""];
    const ord=db.prepare("INSERT INTO cp_orders(order_id,candidate_id,client_id,position,package,order_date,target_date,status,assigned_to,aging,issue,priority) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
    for(let i=1;i<=50;i++) ord.run(`CP-2026-${String(1000+i)}`,((i-1)%40)+1,((i-1)%8)+1,positions[i%8],packages[i%4],`2026-07-${String(Math.max(1,12-(i%9))).padStart(2,"0")}`,`2026-07-${String(13+(i%8)).padStart(2,"0")}`,statuses[i%10],i%4===0?"Unassigned":["Taylor Reed","Jamie Ford","Riley Stone"][i%3],i%11,issues[i%8],i%7===0?"Urgent":i%3===0?"High":"Normal");
    const types=["Social Security Number Trace","County Criminal Search","National Criminal Database","Employment Verification","Education Verification","Motor Vehicle Record","Drug Screening","Healthcare Sanctions Search","Professional License Verification"];
    const s=db.prepare("INSERT INTO cp_searches(search_id,order_id,type,jurisdiction,vendor,date_assigned,due_date,status,result,vendor_cost,court_fee,client_price,notes,last_activity,delay_reason,expected_cost) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for(let i=1;i<=150;i++) { const overdue=i<=8; const unassigned=i>8&&i<=18; const possible=i>=19&&i<=21; const complete=i>21&&i%4===0; s.run(`SRC-${String(5000+i)}`,((i-1)%50)+1,types[i%9],["Denver County, CO","Cook County, IL","Nationwide","Maricopa County, AZ","State of Texas"][i%5],unassigned?"Unassigned":vendors[i%6][0],unassigned?null:"2026-07-08",overdue?"2026-07-09":`2026-07-${String(14+i%7).padStart(2,"0")}`,possible?"Possible Record":unassigned?"Not Started":complete?"Completed":overdue?"Awaiting Vendor":"In Progress",possible?"Potential name and DOB match":complete?"No Record Found":"Pending",i%5===0?42:27,i%7===0?8:0,65,possible?"Disposition document attached":"",overdue?"Vendor contacted 07/10":"Updated 07/11",overdue?"Court backlog":"",27); }
    const qa=db.prepare("INSERT INTO cp_qa(qa_id,order_id,issue_count,priority,reviewer,age,status) VALUES(?,?,?,?,?,?,?)"); for(let i=0;i<10;i++) qa.run(`QA-${801+i}`,i+3,i%4,i<2?"High":"Normal",i%3===0?"Jordan Lee":"Unassigned",i+1,"Pending Review");
    const bill=db.prepare("INSERT INTO cp_billing(order_id,search_id,issue,vendor_cost,expected_cost,client_price,status) VALUES(?,?,?,?,?,?,?)"); ["Vendor fee higher than expected","Search cancelled but still billed","Court access fee not added to invoice","Duplicate vendor fee entered","Client approval required for fee over $50"].forEach((x,i)=>bill.run(10+i,5+i,x,i===0?42:27,27,65,"Open"));
    const audit=db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    const actions=["Status changed","Candidate reminder sent","Vendor assigned","Court fee added","Search sent to QA","QA checklist reviewed","Follow-up date updated","Note added"];
    for(let i=0;i<112;i++) audit.run(`2026-07-${String(1+i%12).padStart(2,"0")} ${String(8+i%9).padStart(2,"0")}:${String(i%60).padStart(2,"0")}:00`,users[i%8][2],users[i%8][1],actions[i%8],i%2?"Order":"Search",i%2?`CP-2026-${1001+i%50}`:`SRC-${5001+i%150}`,"Pending",i%3?"In Progress":"Completed","Seeded operational activity","Web",`DEMO-${100+i%9}`);
    db.prepare("INSERT INTO cp_meta(key,value) VALUES('seed_version','2026.07.12')").run();
  }); tx();
}

export function getClearPath(){ if(instance) return instance; fs.mkdirSync(path.dirname(dbPath),{recursive:true}); instance=new Database(dbPath); schema(instance); const row=instance.prepare("SELECT COUNT(*) c FROM cp_orders").get() as {c:number}; if(!row.c) resetClearPath(); const legacy=instance.prepare("SELECT id,password FROM cp_users WHERE password NOT LIKE 'scrypt$%'").all() as {id:number,password:string}[]; const upgrade=instance.prepare("UPDATE cp_users SET password=? WHERE id=?"); instance.transaction(()=>legacy.forEach(user=>upgrade.run(hashPassword(user.password),user.id)))(); return instance; }
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
    let entityType="Record", before:Row|undefined, after:Row|undefined;
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
      before=db.prepare("SELECT order_id,status,assigned_to,target_date,issue FROM cp_orders WHERE order_id=?").get(entityId) as Row|undefined;
      if(!before) throw new Error("Order not found");
      let status=field(values,"New Status"); if(action.includes("Send")&&action.includes("QA"))status="Quality Review";if(status==="Completed")status="Complete";
      if(status && !allowedStatuses.has(status)) throw new Error("Unsupported status");
      const assignee=field(values,"Assigned Reviewer") || String(before.assigned_to||"");
      if(field(values,"Assigned Reviewer")&&!db.prepare("SELECT 1 FROM cp_users WHERE name=? AND role IN ('QA Reviewer','Administrator')").get(assignee))throw new Error("Assigned reviewer not found");
      const targetDate=field(values,"Follow-Up Date")||String(before.target_date||"");
      if(targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(targetDate))throw new Error("Invalid date");
      db.prepare("UPDATE cp_orders SET status=?,assigned_to=?,target_date=? WHERE order_id=?").run(status||before.status,assignee,targetDate||null,entityId);
      if(note)db.prepare("INSERT INTO cp_notes(entity_type,entity_id,note,created_by,created_at) VALUES('Order',?,?,?,datetime('now'))").run(entityId,note,clean(actor.name,100));
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
    const evidence={record:after,submittedFields:values,requestedEntityId};
    db.prepare("INSERT INTO cp_audit(ts,user,role,action,entity_type,entity_id,previous_value,new_value,note,source,session_id) VALUES(datetime('now'),?,?,?,?,?,?,?,?,?,?)").run(clean(actor.name,100),clean(actor.role,100),action,entityType,entityId,JSON.stringify(before),JSON.stringify(evidence),note,"Web",clean(actor.sessionId,100)||"CURRENT-DEMO");
    return {entityType,entityId,before,after};
  })();
}
