# ClearPath interaction audit

Verified against the canonical Next.js application on port 3010.

| Area | Route/control | Operations | Administrator | Expected result |
|---|---|---:|---:|---|
| Dashboard | `/app/dashboard`, metrics, activity, attention links | Pass | Pass | Links reach queues, audit, reports, and orders |
| Orders | `/app/orders`, order IDs/Open, CSV export | Pass | Pass | Details open; export downloads CSV |
| Orders | New/search/filter/more-filter controls | Pass | Pass | Clearly disabled with demo limitation |
| Order detail | `/app/orders/CP-2026-1001`, back link, action modals | Pass | Pass | Back navigates; actions open dialogs |
| Order detail | Tabs/edit/add-search controls | Pass | Pass | Clearly disabled with demo limitation |
| Queues | `/app/queues` and all nine queue cards | Pass | Pass | Each queue route returns and displays data |
| Queue detail | Back link, row action dialogs, record decisions | Pass | Pass | Navigation/dialog controls respond |
| Queue detail | Priority/assignee filters | Pass | Pass | Clearly disabled with demo limitation |
| Quality | `/app/quality-review`, review dialogs | Pass | Pass | Dialogs open; preview checkboxes are read-only |
| Records | `/app/candidates`, `/app/searches`, `/app/clients`, `/app/billing` | Pass | Pass | Data tables render |
| Vendors | `/app/vendors`, email/contact links | Pass | Pass | Mail client link includes vendor address |
| Vendors | Add vendor | Pass | Pass | Clearly disabled with demo limitation |
| Reports | `/app/reports`, browse/create/details | Pass | Pass | Queue/create routes open; saved details expand |
| Reports | `/app/reports/operations`, cancel/save | Pass | Pass | Cancel returns; valid report persists or error displays |
| Audit | `/app/audit-log`, CSV export | Pass | Pass | CSV downloads; unsupported filters are disabled |
| Administration | `/app/admin` | Redirect | Pass | Operations denied; Administrator receives page |
| Administration | reset cancel/confirm | N/A | Pass | Cancel closes; confirm resets or reports error |
| Administration | configuration/user editing | N/A | Pass | Clearly disabled with demo limitation |
| Client portal | `/client/dashboard`, logout/support | Role denied | Role denied | Internal roles cannot cross portal boundary |
| Candidate portal | `/candidate/dashboard`, logout/support | Role denied | Role denied | Internal roles cannot cross portal boundary |
| Session | Logout | Pass | Pass | Session clears and protected route redirects to login |

Client Administrator and Candidate role smoke tests additionally confirm their own dashboards render, logout works, support uses email links, and unfinished workflows are honestly disabled.
