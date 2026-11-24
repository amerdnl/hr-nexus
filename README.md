# HR Nexus

HR Nexus is a full-stack human resources system: a React web app, an Express API and a
PostgreSQL database. It covers the everyday HR work of a single company, including people,
the org chart, attendance, leave, payroll, performance and reporting, and gives
administrators, managers and employees each the view that fits their role.

Everything you see in it belongs to **Meridian**, a fictional Malaysian software company
whose data is rebuilt around today's date, so it always looks like a company that used
the system this morning. No person, address, phone number or email in it is real.

## Public demo

Anyone can sign in and look around:

| | |
| --- | --- |
| Email | `demo@meridian.example` |
| Password | `meridian-demo` |

The login page of a demo deployment shows these and offers **Use demo account**. The
account is an HR administrator, so it can open every module: people, the org chart,
attendance, leave, payroll and payslips, performance, onboarding and offboarding,
reports, analytics and the audit log. It **cannot change anything**: settings and
policies, its own email or password, users and invitations, deletions and every other
write are refused by the API with *"This is disabled in the demo"*, not merely hidden in
the interface. The data is rebuilt every night, and a banner in the app says so.

This password belongs to the demo alone and is published on purpose. Never use it for
anything else.

How it works:

- **Read-only, enforced by the API.** The account has `users.demo_read_only` set
  (migration 0023). The authentication middleware refuses every non-read request from
  such an account before any route runs, except signing out and marking its own
  notifications and announcements read
  (`backend/src/middleware/demoReadOnly.ts`). A route added later is covered without
  anyone remembering to cover it. `backend/tests/demo-readonly.integration.test.ts`
  proves each blocked action is refused and the database is left byte-for-byte unchanged.
- **Always current.** `backend/src/database/presentationData.ts` describes the company,
  and every date a viewer reads as "now" is computed from the company's today: who is in
  and who is on leave, new joiners and their onboarding, the last three paid payroll
  months and this month's calculated run, the open review cycle (the quarter just ended),
  announcements, events, notifications and the audit trail.
- **Reset nightly.** `vercel.json` schedules Vercel Cron to call `GET /api/demo/reset`
  at 19:00 UTC (03:00 in Kuala Lumpur). The endpoint exists only when `DEMO_MODE=true`,
  requires `Authorization: Bearer $CRON_SECRET` (which Vercel Cron sends), and rebuilds
  the whole company in one transaction. It refuses any database holding people or
  accounts outside the demo's reserved ID range, so it cannot empty a real one.

## What HR Nexus does

- **People**: employee records, departments, a company directory, social profiles and a
  timeline.
- **Org chart**: positions as well as people, filled and vacant seats, more than one
  reporting line, external advisers, and an edit mode for administrators.
- **Workplace**: an Action Center of work waiting for you, notifications, global search
  (Ctrl+K / ⌘K), a company calendar, announcements and recognition.
- **Attendance**: check-in and check-out verified with the office QR code and location,
  plus audited corrections by HR.
- **Leave**: requests counted in working days from the company calendar, policies,
  entitlements and balances.
- **Payroll**: calculation → review → approval → paid, with payslips. Statutory amounts
  (EPF, SOCSO, EIS, PCB) are entered as manual lines and are not calculated.
- **Performance**: goals with progress history, review cycles, self-reviews and manager
  reviews.
- **Onboarding and offboarding**: templates and per-person plans.
- **Reports and analytics**: workforce, attendance, leave, payroll, onboarding, performance
  and recognition; CSV and Excel export; employee import.
- **Audit log**: an append-only record of sensitive actions.
- **Home**: a personalised dashboard of widgets and Smart Stacks, with an approved default.

## User roles

Accounts have one of two stored roles, `admin` or `employee`. **Manager is not a stored
role**: anyone who currently has direct reports gains the manager view, and loses it on
their next request once the last report moves. Every permission is checked by the API on
each request using live data. The interface only hides what the API would refuse anyway.

### Admin / HR

Manages the company: employees, departments, reporting lines and the org chart (including
edit mode), attendance and corrections, leave policies and decisions, payroll, onboarding
and offboarding, review cycles, announcements, holidays, company settings, reports,
import and export, and the audit log.

### Manager

Keeps their own self-service pages and gains a team layer for their **direct** reports:
who is in today, team attendance, leave decisions (including reasons), team goals and
manager reviews. A manager never sees a report's pay, personal details or private
recognition, or anyone outside their team.

### Employee

Self-service: attendance check-in, leave requests and balances, payslips, goals and
self-reviews, onboarding tasks, recognition, profile and password. Colleagues are visible
only through their social profile. Employment fields (job title, department, status and so
on) are read-only and managed by HR.

The full permission model and profile visibility matrix are in
[docs/HR_NEXUS_V3_ARCHITECTURE.md](docs/HR_NEXUS_V3_ARCHITECTURE.md), sections 2–4.

## Project structure

```text
hr-nexus/
├── frontend/                 React 19 + TypeScript + Vite + Tailwind CSS
├── backend/                  Node.js + Express 5 + TypeScript + pg
│   ├── src/
│   │   ├── routes/ controllers/ services/   the API, by module
│   │   ├── auth/policy.ts                   who may do what
│   │   └── database/                        migration runner, seeders, demo reset
│   ├── migrations/           numbered SQL migrations (0001 onwards), never edited once applied
│   └── tests/                unit tests, plus database suites that run only in a lab
├── api/index.js              GENERATED serverless bundle of the API, committed for Vercel
├── database/schema.sql       the base schema every migration builds on
├── docs/                     reference docs and rollback SQL (see below)
├── scripts/                  presentation reset, integrity check, migration rehearsal
├── docker-compose.yml        Meridian (default) environment
├── docker-compose.demo.yml   the public demo, run locally
└── vercel.json               Vercel build, routing and the nightly demo reset
```

What remains in `docs/`:

| Path | Why it is kept |
| --- | --- |
| `docs/HR_NEXUS_V3_ARCHITECTURE.md` | Permission model, visibility matrix, API route map, Home widgets |
| `docs/sql/rollback_*.sql` | Review-only rollbacks. **The database test suites read these files** |
| `docs/sql/verify_history_retention.sql` | Read-only verification query for migration 0001 |

## Requirements

- **Docker Desktop** with Docker Compose. This is the simplest way to run everything.
- **Node.js 24** and npm, for running tests and builds outside Docker. The containers use
  `node:24-alpine`.
- **PostgreSQL 17**, only if you run the database outside Docker.

## Local setup

Clone the repository, then pick an environment. Both can run at the same time; they use
separate containers, volumes, databases, ports and secrets.

| | Meridian (default) | Public demo |
| --- | --- | --- |
| Compose file | `docker-compose.yml` | `docker-compose.demo.yml` |
| Settings file | `.env` | `.env.demo` |
| Frontend | http://localhost:5173 | http://localhost:5175 |
| API | http://localhost:5001/api | http://localhost:5003/api |
| Postgres | `localhost:5433` | `127.0.0.1:5436` |
| Database | `hr_nexus_v3_presentation` | `hr_nexus_public_demo` |
| Loaded by | `seedPresentation.ts`, once | `resetDemo.ts`, on every `up` |
| Sign-ins | three, with `PRESENTATION_PASSWORD` | the read-only demo account |

### Meridian (default environment)

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET and PRESENTATION_PASSWORD
docker compose up -d --build
```

On first start, the `presentation-setup` container applies the migrations and seeds
Meridian. On later starts it sees the company is already there and leaves it
alone. Open http://localhost:5173 and sign in with `PRESENTATION_PASSWORD` as:

| Account | View |
| --- | --- |
| `hr@meridian.example` | HR administrator |
| `sarah@meridian.example` | Sarah Ahmad, Engineering Manager with five direct reports |
| `ben@meridian.example` | Ben Wong, Software Engineer who reports to Sarah |

The read-only `demo@meridian.example` account is loaded here too.

Everyday commands:

```bash
docker compose ps                 # what is running
docker compose logs -f backend    # follow the API log
docker compose restart backend    # restart one service
docker compose down               # stop; the database volume is kept
```

> **Avoid `docker compose down -v`.** The `-v` flag deletes the database volume.

Health checks: http://localhost:5001/api/health and
http://localhost:5001/api/health/database.

### Public demo (run locally)

```bash
cp .env.demo.example .env.demo
# edit .env.demo: set POSTGRES_PASSWORD, JWT_SECRET and CRON_SECRET (openssl rand -hex 32)
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

Open http://localhost:5175 and choose **Use demo account**. Every `up` migrates the demo
database and rebuilds Meridian for today. To rebuild it again at any time, either
re-run the setup service or call the reset endpoint the cron uses:

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo run --rm demo-setup
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:5003/api/demo/reset
```

Set `PRESENTATION_PASSWORD` in `.env.demo` if you also want to sign in locally as the
HR administrator, manager or employee (for example to capture those views). Leave it
unset for a public deployment: those accounts then get a random password nobody knows.

`docker compose -f docker-compose.demo.yml down -v` deletes only the demo's own volume.

### Running without Docker (optional)

You need a PostgreSQL database that already has the schema and migrations (see
[Database](#database)). Then:

```bash
cd backend && cp .env.example .env    # set DATABASE_URL, JWT_SECRET
npm install && npm run dev            # API on http://localhost:5000

cd frontend && cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:5000/api
npm install && npm run dev            # app on http://localhost:5173
```

## Environment variables

Templates are committed: `.env.example`, `.env.demo.example`, `.env.vercel.example`,
`backend/.env.example` and `frontend/.env.example`. Copy one, fill it in, and keep the copy
local. Git ignores every `.env` and `.env.*` file except the `*.example` templates.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API | The application database. The API will not start without it. |
| `JWT_SECRET` | API | Signs sign-in tokens. Long, random, and different in every environment. |
| `JWT_EXPIRES_IN` | API | Session length, e.g. `8h` locally or `7d` on Vercel. |
| `FRONTEND_URL` | API | Allowed CORS origin. Defaults to `http://localhost:5173`. |
| `PORT` | API | Port the API listens on (5000 inside the container). |
| `PROFILE_IMAGE_DIR` | API | Where profile photos are written. Leave unset on Vercel to turn uploads off. |
| `VITE_API_BASE_URL` | Frontend, at build time | Where the app calls the API. `/api` on Vercel. |
| `MIGRATION_DATABASE_URL` | `migrate`, `db:schema` | The database to migrate. Never falls back to `DATABASE_URL`. |
| `DEMO_MODE` | API | `true` turns on `/api/demo` and the nightly reset. Anything else leaves them off. |
| `CRON_SECRET` | API | Protects `/api/demo/reset` (16+ characters). Vercel Cron sends it as a bearer token. |
| `DEMO_DATABASE_URL` | `demo:reset` | The database `npm run demo:reset` rebuilds. Never falls back to `DATABASE_URL`. |
| `PRESENTATION_PASSWORD` | Meridian seeder, `demo:reset` | Password for the admin, manager and employee sign-ins. Not the demo account's. |
| `POSTGRES_PASSWORD` | Docker Compose | Password for the environment's own Postgres container. |

Store real values only in your local `.env` files or in the Vercel dashboard. Never in a
tracked file.

## Database

- **`database/schema.sql`** is the base schema. Docker applies it automatically when a
  database volume is first created. For an empty hosted database, run `npm run db:schema`.
- **`backend/migrations/`** holds numbered, checksummed migrations, applied in order by
  `backend/src/database/migrate.ts`. Each runs in its own transaction under an advisory
  lock. Migrations are **never** run automatically when the API starts, and an applied
  migration is never edited: changes go in the next number.
- **Seeders** load data. `presentationLoader.ts` writes Meridian; it is used by
  `seedPresentation.ts` (the default environment, loaded once) and by `demoReset.ts`
  (the public demo, rebuilt from empty tables). `seedDemo.ts` builds the small company
  used by the database test suites. Each one refuses to run against the wrong database.

Running migrations by hand (from `backend/`). The `--database` name must match the
database the URL actually connects to, or the command refuses:

```bash
export MIGRATION_DATABASE_URL='postgresql://…/<database>'
npm run migrate:status -- --database <database>   # read-only
npm run migrate:apply  -- --database <database>
```

Setting up an **empty hosted database** (one time, from your own machine):

```bash
cd backend
MIGRATION_DATABASE_URL='…' npm run db:schema -- --database <database>
MIGRATION_DATABASE_URL='…' npm run db:migrate -- --database <database>
DEMO_DATABASE_URL='…' npm run demo:reset -- --database <database>
```

Back up a local environment with `pg_dump` into `.local-backups/`, which Git ignores.
Dumps contain password hashes, so keep them off shared drives:

```bash
docker exec hr-nexus-postgres pg_dump -U postgres -d hr_nexus_v3_presentation \
  --no-owner --no-privileges > .local-backups/meridian-$(date +%Y%m%d-%H%M%S).sql
```

## Org chart

**People → Org chart** (`/org`). The chart is drawn from employee records, but a record
need not be a person:

- **Position type** (`position_kind`): `staff` is a person employed here, `vacant` is a
  seat on the chart, and `external` is an outside firm or adviser.
- **Occupancy**: whether a seat is `vacant`, `filled` by a named person, or
  `filled_unnamed`, shown as "filled, employee details not entered". The system never
  invents a person to fill a seat.
- **Primary manager** (`manager_id`) is the one *operational* reporting line. Team scope,
  leave approval and every permission rule read this line and nothing else.
- **Additional reporting relationships** are real lines that are not the operational one,
  for example interns who answer to several executives. They appear on the chart and are
  ignored by every permission rule. A line can be marked confirmed or unconfirmed;
  unconfirmed lines are drawn dashed and labelled "Reporting line unconfirmed".
- **External / advisory** entries appear under *Not connected to the chart* when they have
  no reporting line.
- **Who is counted**: vacant and external entries appear on the chart and in the directory,
  but are excluded from headcounts, reports, payroll, review cycles and onboarding. The
  rule lives in `backend/src/auth/policy.ts`, and `position-kind-scope.test.ts` fails if
  a query drops it.

**Edit mode (admins only).** Choose **Edit org chart**, then:

- **Drag a card** to move it. Card positions are saved as layout. Moving a card does not
  change who reports to whom.
- **Add position** to create a seat: title, department, type, status, primary manager,
  "also reports to", and role notes.
- Use **⋯** on a card to edit it, add a direct report, or start a reporting line (then
  click the card it should report to). Click a line to change or remove it.
- **Add note** to place an information panel (a heading and lines of text) on charts
  imported from a source drawing.
- **Done editing** leaves edit mode. **Print or save as PDF** expands every branch first.

These actions are all enforced by the API (`/api/org/*`, admin only), not just hidden in
the interface. Changes to positions, relationships and notes go to the audit log; card
movements do not.

Charts imported from a drawing keep their source coordinates
(`org_chart_source_layout`). Companies without one, such as Meridian, are laid out
automatically. Meridian's chart has three open seats (vacant positions) alongside its
34 people.

## Testing

```bash
cd backend
npm run type-check
npm test               # unit tests; database suites are skipped unless enabled

# the public demo's read-only rule and reset, against the local demo's Postgres
# (creates and drops its own throwaway database there)
HR_NEXUS_DEMO_TEST_SERVER_URL="postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5436/postgres" \
  node --import tsx --test tests/demo-readonly.integration.test.ts

cd frontend
npm run build          # type-checks and builds
npm run lint
npm run check:bundle   # every page lazy-loaded, first-visit JS within budget
```

**Database suites** (migrations, authorisation, the security matrix and every workflow)
never touch an application database. They run in a throwaway container on the isolated
`hr-nexus-v2-migration-lab` network, against clones of the baseline database
`hr_nexus_v2_settings_baseline` (and `hr_nexus_v2_upgrade` for the oldest migration
tests). The lab's Postgres keeps its data in memory (tmpfs), so after the lab container
restarts, restore those baselines from the dumps in `.local-backups/0001-20260908/`. From
the repository root:

```bash
docker run --rm --volumes-from hr-nexus-backend:ro --network hr-nexus-v2-migration-lab \
  -e HR_NEXUS_MIGRATION_LAB=1 -e HR_NEXUS_SETTINGS_LAB=1 -e HR_NEXUS_EMPLOYEE_LAB=1 \
  -e HR_NEXUS_IMPORT_LAB=1 -e HR_NEXUS_ATTENDANCE_LAB=1 -e HR_NEXUS_LEAVE_LAB=1 \
  -e HR_NEXUS_PAYROLL_LAB=1 -e HR_NEXUS_REPORTS_LAB=1 -e HR_NEXUS_AUDIT_LAB=1 \
  -e HR_NEXUS_DEMO_LAB=1 -e HR_NEXUS_DASHBOARD_LAB=1 -e HR_NEXUS_EXPORT_LAB=1 \
  -e HR_NEXUS_PASSWORD_LAB=1 -e HR_NEXUS_V3_LAB=1 -e HR_NEXUS_DB_TESTS=1 \
  -e DATABASE_URL=postgresql://postgres@hr-nexus-v2-migration-lab/postgres \
  --mount "type=bind,src=$PWD/database,dst=/database,readonly" \
  --mount "type=bind,src=$PWD/docs,dst=/docs,readonly" \
  hr-nexus-backend sh -c "node --import tsx --test tests/*.test.ts"
```

`scripts/rehearse-migrations.sh` creates a fresh isolated lab and rehearses the migration
chain on a copy of the local database. `scripts/presentation-reset.sh` and
`scripts/presentation-integrity.sql` rebuild and check a Meridian copy hosted in that lab.

## Deployment (Vercel)

Vercel publishes two things from this repository:

| What | Source |
| --- | --- |
| The site | `frontend/dist`, built by `vercel.json`'s `buildCommand` |
| The API | `api/index.js`, one self-contained serverless function |

`vercel.json` rewrites `/api/*` to the function and every other path to `index.html`, so
links deep inside the app (such as `/org`) load the app instead of a 404.

**`api/index.js` is a generated, committed bundle.** It is the backend bundled with
esbuild into CommonJS, so Vercel has nothing to install or resolve for the API. **Whenever
anything in `backend/src` changes, rebuild it and commit the result:**

```bash
npm --prefix backend run build:api
```

Before the first deployment:

1. Create a hosted PostgreSQL database **used only by the demo** (the nightly reset
   empties it). Neon URLs already include `?sslmode=require`; keep it.
2. From your own machine, apply the schema and migrations, then build the demo once
   (see [Database](#database)). The deployed API never runs migrations, and it needs
   migration 0023 before it starts, so migrate **before** deploying this version.
3. In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL`,
   `JWT_SECRET`, `JWT_EXPIRES_IN`, `VITE_API_BASE_URL=/api`, `DEMO_MODE=true` and
   `CRON_SECRET`. `.env.vercel.example` documents each variable.
4. Deploy. `vercel.json` registers the nightly cron; check it under Project → Settings →
   Cron Jobs, where **Run** triggers it once by hand.

Profile photo uploads are off on Vercel because the serverless filesystem is read-only.
The API returns 503 for uploads instead of crashing. Setting
`PROFILE_IMAGE_DIR=/tmp/profile-images` keeps photos only for the life of one instance;
durable photos would need object storage.

Check a deployment:

```bash
curl -s https://<deployment>/api/health                                # {"success":true,...}
curl -s -o /dev/null -w '%{http_code}\n' https://<deployment>/login    # 200, not 404
curl -s https://<deployment>/api/demo                                  # the demo sign-in
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<deployment>/api/demo/reset   # rebuilds today's data
```

For a short-lived preview of a local environment, a tunnel such as a Cloudflare Quick
Tunnel works. Treat its URL as temporary and public, and never as a deployment.

## Security notes

- Never commit `.env` files, passwords, database URLs or JWT secrets. Use the `*.example`
  templates and the Vercel dashboard.
- Use a fresh `JWT_SECRET` and database password for every environment.
- Authorisation is enforced by the API on every request. Each request re-reads the account,
  its role, its employee link and its manager scope, so a deactivated account or a changed
  reporting line loses access immediately even though tokens have no revocation list.
- Passwords are stored only as bcrypt hashes (`bcryptjs`). Generated passwords for new
  employees must be changed at first sign-in. The Meridian accounts are the exception, so
  never reuse their passwords anywhere real. The public demo password is published on
  purpose and works only for an account the API keeps read-only.
- `/api/demo/reset` empties the database it runs against. It exists only with
  `DEMO_MODE=true`, needs `CRON_SECRET`, and refuses any database holding people or
  accounts outside the demo's reserved range.
- The audit log never stores passwords, tokens, QR secrets, coordinates or private text.
- Keep production database credentials out of shells, logs and screenshots. The migration
  and bootstrap scripts read their own variables so they can never pick up `DATABASE_URL`
  by accident.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Sign-in fails with credentials you know are correct | The frontend is calling the wrong environment's API. Check `VITE_API_BASE_URL` (5001 for Meridian, 5003 for the demo). Without it, the frontend falls back to 5001 and logs a console warning. |
| "This is disabled in the demo" | You are signed in as the read-only demo account. That is the point; sign in as another account to change data. |
| The demo shows yesterday's date as today | The nightly reset did not run. Check Vercel → Cron Jobs, or call `/api/demo/reset` with the secret. |
| Browser reports a CORS error | `FRONTEND_URL` on the API does not match the address the app is served from. |
| Vite starts on 5174 instead of 5173 | Another process already uses the port, perhaps the other environment. Stop it, or point `FRONTEND_URL` at the new port. |
| `docker compose up` says a port is already allocated | An old container or a local Postgres holds it. Use `docker ps` to find it, then stop it. |
| `MIGRATION_DATABASE_URL is required` | The migration and schema scripts never use `DATABASE_URL`. Export `MIGRATION_DATABASE_URL` and pass a matching `--database`. |
| `/api/health` returns 500 on Vercel | Check the function log. The stack trace should name `/var/task/api/index.js`; if it doesn't, rebuild with `build:api` and redeploy. |

## Development workflow

```text
branch → implement → test → commit → push → pull request into main
```

```bash
git switch main && git pull
git switch -c feature/<name>
# …work, then run the checks in Testing…
git commit -m "feat: describe the change"
git push -u origin feature/<name>
```

If you changed `backend/src`, rebuild and commit `api/index.js`. Add schema changes as a
new numbered migration.

## Known limitations

- Malaysian statutory payroll (EPF, SOCSO, EIS, PCB) is not automated.
- Manager scope covers direct reports only, not the whole branch below them.
- Five historical attendance rows belong to employees deleted before V2. They are
  protected history and are never reconciled or deleted.
- Some list filters are not stored in the URL and reset on reload.

## License

Developed for educational purposes as a group project.
