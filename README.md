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

## Architecture

- Next.js, React, and TypeScript
- Durable SQLite operational dataset
- Server-side login, audit events, reports, workflow updates, and complete demo reset
- 50 seeded orders, 150 searches, 10 QA items, and 100+ audit events

The `here-demo/` directory contains the static public demonstration published to here.now. The full local application retains server-side SQLite persistence.
