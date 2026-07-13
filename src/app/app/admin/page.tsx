import {Badge,PageHead} from "@/components/Portal";
import DemoDataReset from "@/components/DemoDataReset";
import {CLEARPATH_SEED_VERSION, rows} from "@/lib/clearpath";
import {isDemoResetEnabled} from "@/lib/demo";

function count(table:string){return Number(rows(`SELECT COUNT(*) count FROM ${table}`)[0]?.count??0);}

export default function Administration(){
  const users=rows("SELECT id,name,email,role FROM cp_users ORDER BY role,name");
  const settings=[
    ["Clients",`${count("cp_clients")} active employer accounts`],
    ["Screening Packages","Basic, Standard, Professional, Healthcare"],
    ["Search Products","Nine configured screening products"],
    ["Vendors",`${count("cp_vendors")} approved research partners`],
    ["Queue Rules","Nine manual operational queues"],
    ["Status Options","Order, search, QA, and billing states"],
    ["Reason Codes","QA returns and workflow exceptions"],
    ["Message Templates",`${(()=>{try{return count("cp_message_templates")}catch{return 0}})()} candidate/client templates`],
    ["Fee Thresholds","Routine and approval-required billing paths"],
    ["SLA Settings","Due dates and aging thresholds"],
  ];
  return <div className="page"><PageHead eyebrow="SYSTEM CONFIGURATION" title="Administration" subtitle="Review seeded operational configuration and restore the complete demo dataset." actions={isDemoResetEnabled()?<DemoDataReset/>:undefined}/><div className="admin-layout"><section className="card table-card"><div className="card-head"><div><h2>Users and Roles</h2><p>Durable accounts available in this environment</p></div><Badge tone="green">{users.length} active</Badge></div><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map(user=><tr key={String(user.email)}><td><b>{user.name}</b></td><td>{user.email}</td><td><Badge tone="blue">{user.role}</Badge></td><td><Badge tone="green">Active</Badge></td></tr>)}</tbody></table></section><aside><section className="card admin-config"><div className="card-head"><div><h2>Configuration Registry</h2><p>Seeded controls used by the operational workflows</p></div></div>{settings.map(setting=><div className="setting-row" key={setting[0]}><span aria-hidden="true">⚙</span><div><b>{setting[0]}</b><small>{setting[1]}</small></div><Badge tone="gray">Configured</Badge></div>)}</section><section className="card demo-panel"><span>DEMO ENVIRONMENT</span><h2>Dataset Status</h2><div><b>{count("cp_orders")}</b> Orders</div><div><b>{count("cp_searches")}</b> Searches</div><div><b>{count("cp_audit")}</b> Audit events</div><p>Seed version {CLEARPATH_SEED_VERSION}<br/>SQLite server-side persistence</p></section></aside></div></div>;
}
