# ClearPath interaction audit

This file records verified behavior rather than treating visible-but-disabled controls as a passing implementation.

## Automated quality gates

- `npm run test:api` exercises authenticated server endpoints, validation, persistence, audit evidence, and reset behavior against the local SQLite seed.
- `npm run test:browser` uses the installed Google Chrome against `localhost:3010`, one worker at a time.
- Both suites reject non-local base URLs so they cannot reset or exercise production accidentally.
- Browser coverage includes login, every sidebar route, every queue card/route, runtime console and page errors, unique enabled action types, downloads, safe modal open/cancel flows, and the release queue.
- `tests/browser/order-quality.spec.ts` enforces working order creation/editing/tab/add-search controls plus card spacing, search-row layout, and horizontal-overflow constraints.
- Persistence scenarios reset the local seed around every mutating case and verify the saved result after a browser reload.

## Verified working behavior

| Area | Verified behavior |
|---|---|
| Authentication | Seeded login, signed session, role boundary, logout |
| Application shell | Sidebar destinations, workspace search dialog, help, notifications, user menu |
| Queue routing | All nine canonical queue routes load seeded rows; release route is `/app/queues/reports-ready-to-release` |
| Orders | Search/filter/reset, CSV export, persisted New Order creation, detail tabs, order/candidate editing, Add Search, document recording, and responsive row spacing |
| Queue workflows | Candidate request, vendor assignment, verification attempt, overdue vendor contact, criminal review, QA approval/release, and billing resolution persist on the exact record |
| Vendors | Vendor create/edit and in-system message history persist through reload |
| Candidate portal | Disclosure, authorization signature, and document metadata persist through reload |
| Client portal | Tenant-bound order submission remains visible to the same client after reload |
| Reports | Morning operations report creation remains listed with its summary and priority actions after reload |
| Billing | Client invoice creation remains in the exception invoice history after reload |
| Existing action triggers | Enabled order, queue, QA, billing, vendor, report, audit, and reset triggers open/navigate/download without page errors |
| Persistence APIs | Typed mutations, validation, role boundaries, audit evidence, and reset behavior |
| Reset | Administrator-only transactional seed reset |

## Remaining limitations found in review

| Severity | Area | Current behavior |
|---|---|---|
| P2 | Administration | Users and configuration are review-only; the only supported write is the full demo reset |
| P2 | Audit | The workspace loads the newest 500 events and has no pagination beyond that limit |
| Scope | Quality gate | Browser mutation tests are intentionally restricted to localhost and do not mutate the production deployment |

## Review rule

A control passes only if it has a clear outcome, completes that outcome through the visible UI, persists any operational write, survives reload, and creates the required audit evidence. A disabled core-workflow control is a failure, not a pass.
