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

Run the repeatable 90-assertion backend suite while the development server is running:

```bash
npm run test:e2e
```

## Architecture

- Next.js, React, and TypeScript
- Durable SQLite operational dataset
- Server-side login, audit events, reports, workflow updates, and complete demo reset
- 50 seeded orders, 150 searches, 10 QA items, and 100+ audit events

## Deployment

The canonical application requires a Node.js runtime and persistent disk because operational actions are server-backed. `render.yaml` describes a compatible deployment. Set a strong `SESSION_SECRET` in every hosted environment.

The former hand-written here.now artifact was removed. here.now is a static host and cannot run the canonical Next.js and SQLite application. A here.now URL may redirect or link to the canonical Node deployment, but the UI must not be independently reimplemented there.
