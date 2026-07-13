# ClearPath Screening

A realistic background-screening operations portal built for external Workflow AS demonstrations.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3010` and sign in with:

- Email: `operations@clearpath.local`
- Password: `demo123`
- Role: `Operations Specialist`

Run the repeatable backend and browser acceptance suites while the development server is running:

```bash
npm run test:e2e
```

## Architecture

- Next.js, React, and TypeScript
- Durable SQLite operational dataset
- Server-side login, audit events, reports, workflow updates, and complete demo reset
- 50 seeded orders, 150 searches, 10 pending QA reviews, 12 approved release-ready reports, and 100+ audit events

## Reseed demo data

Administrators and Operations Specialists can select **Reseed demo data** from the
global application header. Administrators also have the action on the Administration
page. The confirmation-protected action restores the complete canonical dataset while
keeping the current login active.

Hosted production environments must explicitly set `CLEARPATH_ALLOW_DEMO_RESET=true`
to expose this demo utility. This flag controls the manual reseed UI and API; the
application remains a seeded demo rather than a production system of record.

## Deployment

The canonical application requires a Node.js runtime and persistent disk because operational actions are server-backed. `render.yaml` describes a compatible demo deployment. Set a strong `CLEARPATH_SESSION_SECRET` in every hosted environment.

The former hand-written here.now artifact was removed. here.now is a static host and cannot run the canonical Next.js and SQLite application. A here.now URL may redirect or link to the canonical Node deployment, but the UI must not be independently reimplemented there.
