# HR Nexus

HR Nexus is a full-stack human resources system: a React web app, an Express API and a
PostgreSQL database. It covers the everyday HR work of a single company, including people,
the org chart, attendance, leave, payroll, performance and reporting.

This repository is a **public mock-up**. There is one version of it, for anyone to look
at: one link, one sign-in and one set of made-up data.

## Try it

| | |
| --- | --- |
| Link | _coming soon (the hosted demo is not live yet)_ |
| Email | `demo@meridian.example` |
| Password | `meridian-demo` |

The login page shows these and has a **Use demo account** button that fills them in.

Everything in it belongs to **Meridian**, a fictional Malaysian software company with 34
staff and 3 open positions. No person, address, phone number or email in it is real. The
data is rebuilt around today's date, so it always looks like a company that used the
system this morning.

The demo account is an HR administrator, so it can open every module. It **cannot change
anything**: settings, its own email or password, users, deletions and every other write
are refused by the API with *"This is disabled in the demo"*, not merely hidden in the
interface. It is the **only** account that can sign in. The data is rebuilt every night.

This password belongs to the demo alone and is published on purpose. Never use it for
anything else.

### How it works

- **One sign-in.** Every other account in the data (the HR administrator, Sarah the
  manager, Ben the employee) exists so the records have someone who approved the leave or
  ran the payroll. None of them can sign in: their password hash matches no password, and
  with `DEMO_MODE=true` the API refuses any sign-in or session that is not the demo
  account's.
- **Read-only, enforced by the API.** The demo account has `users.demo_read_only` set
  (migration 0023). The authentication middleware refuses every non-read request from it
  before any route runs, except signing out and marking its own notifications and
  announcements read (`backend/src/middleware/demoReadOnly.ts`). A route added later is
  covered without anyone remembering to cover it.
- **Always current.** `backend/src/database/presentationData.ts` describes the company,
  and every date that reads as "now" is computed from the company's today: who is in and
  who is on leave, new joiners, the last three paid payroll months and this month's
  calculated run, the open review cycle, announcements, notifications and the audit trail.
- **Reset nightly.** `vercel.json` schedules Vercel Cron to call `GET /api/demo/reset` at
  19:00 UTC (03:00 in Kuala Lumpur). The endpoint exists only when `DEMO_MODE=true`,
  requires `Authorization: Bearer $CRON_SECRET` (which Vercel Cron sends), and rebuilds the
  whole company in one transaction. It refuses any database holding people or accounts
  outside the demo's reserved ID range, so it cannot empty a real one.

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

The demo signs in as Admin / HR. The full permission model and profile visibility matrix are in
[docs/HR_NEXUS_V3_ARCHITECTURE.md](docs/HR_NEXUS_V3_ARCHITECTURE.md), sections 2–4.

## Project structure

```text
hr-nexus/
├── frontend/                 React 19 + TypeScript + Vite + Tailwind CSS
├── backend/                  Node.js + Express 5 + TypeScript + pg
│   ├── src/
│   │   ├── routes/ controllers/ services/   the API, by module
│   │   ├── auth/policy.ts                   who may do what
│   │   └── database/                        migration runner, the Meridian data, demo reset
│   ├── migrations/           numbered SQL migrations (0001 onwards), never edited once applied
│   └── tests/                unit tests, plus database suites that run only in a lab
├── api/index.js              GENERATED serverless bundle of the API, committed for Vercel
├── database/schema.sql       the base schema every migration builds on
├── docs/                     architecture reference and rollback SQL
├── scripts/demo-integrity.sql  read-only cross-module check of the demo data
├── docker-compose.yml        runs the demo locally
└── vercel.json               Vercel build, routing and the nightly reset
```

`docs/sql/rollback_*.sql` are review-only rollbacks that the database test suites read.

## Run it locally

You need **Docker Desktop** with Docker Compose. Node.js 24 is only needed for tests and
builds outside Docker.

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, JWT_SECRET and CRON_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

Open http://localhost:5175 and choose **Use demo account**. Every `up` migrates the
database and rebuilds Meridian for today. To rebuild it again at any time:

```bash
docker compose run --rm demo-setup
```

| | |
| --- | --- |
| App | http://localhost:5175 |
| API | http://localhost:5003/api (health: `/api/health`) |
| Postgres | `127.0.0.1:5436`, database `hr_nexus_public_demo` |

`docker compose down` stops it; `docker compose down -v` also throws the data away.

Check the data is coherent across modules (every row should say PASS):

```bash
docker exec -i hr-nexus-demo-postgres psql -U postgres -d hr_nexus_public_demo \
  -Atq -f - < scripts/demo-integrity.sql
```

## Environment variables

`.env.example` is the only template. Git ignores every `.env` and `.env.*` file except it.

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API | The demo database. The API will not start without it. |
| `JWT_SECRET` | API | Signs sign-in tokens. Long and random. |
| `JWT_EXPIRES_IN` | API | Session length, e.g. `8h`. |
| `DEMO_MODE` | API | Must be `true`: makes the demo account the only sign-in and turns on the reset. |
| `CRON_SECRET` | API | Protects `/api/demo/reset` (16+ characters). Vercel Cron sends it as a bearer token. |
| `VITE_API_BASE_URL` | Frontend, at build time | Where the app calls the API. `/api` on Vercel. |
| `MIGRATION_DATABASE_URL` | `db:schema`, `db:migrate` | The database to set up. Never falls back to `DATABASE_URL`. |
| `DEMO_DATABASE_URL` | `demo:reset` | The database to rebuild. Never falls back to `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | Docker Compose | Password for the local Postgres container. |

## Database

- **`database/schema.sql`** is the base schema. Docker applies it when the volume is first
  created; for an empty hosted database run `npm run db:schema`.
- **`backend/migrations/`** holds numbered, checksummed migrations applied in order by
  `backend/src/database/migrate.ts`. They never run automatically when the API starts.
- **`backend/src/database/demoReset.ts`** empties every table and writes Meridian
  (`presentationLoader.ts`, from `presentationData.ts`). It is the only way data gets in,
  used by the nightly cron, by `npm run demo:reset` and by `docker compose up`.

The `--database` name must match the database the URL connects to, or the command refuses.

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

Meridian's chart is laid out automatically. Meridian's chart has three open seats (vacant positions) alongside its
34 people.

## Testing

```bash
cd backend
npm run type-check
npm test               # unit tests; database suites are skipped unless enabled

# the one-sign-in rule, the read-only rule and the reset, against the local Postgres
# (creates and drops its own throwaway database there)
HR_NEXUS_DEMO_TEST_SERVER_URL="postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5436/postgres" \
  node --import tsx --test tests/demo-readonly.integration.test.ts

cd frontend
npm run build          # type-checks and builds
npm run lint
npm run check:bundle   # every page lazy-loaded, first-visit JS within budget
```

The other database suites (migrations, authorisation, the security matrix and every
workflow) are skipped by default. They only run inside an isolated, in-memory lab
container (`hr-nexus-v2-migration-lab`) against throwaway clones, enabled with the
`HR_NEXUS_*_LAB=1` variables listed in each test file.

## Deployment (Vercel): one link

Vercel publishes the site (`frontend/dist`) and the API (`api/index.js`, one
self-contained serverless function). `vercel.json` rewrites `/api/*` to the function and
every other path to `index.html`, and registers the nightly reset cron.

**`api/index.js` is a generated, committed bundle.** Whenever anything in `backend/src`
changes, rebuild it and commit the result:

```bash
npm --prefix backend run build:api
```

Setting up the one hosted demo:

1. **Database.** Create a hosted PostgreSQL database used **only** by the demo (the
   nightly reset empties it), for example a new Neon database. Keep `?sslmode=require`.
2. **Fill it, from your own machine**, before deploying (the API needs migration 0023):

   ```bash
   cd backend
   MIGRATION_DATABASE_URL='<demo url>' npm run db:schema  -- --database <name>
   MIGRATION_DATABASE_URL='<demo url>' npm run db:migrate -- --database <name>
   DEMO_DATABASE_URL='<demo url>'      npm run demo:reset -- --database <name>
   ```

3. **Environment variables** (Vercel → Project → Settings → Environment Variables, for
   Production): `DATABASE_URL=<demo url>`, `JWT_SECRET` (`openssl rand -base64 48`),
   `JWT_EXPIRES_IN=7d`, `DEMO_MODE=true`, `CRON_SECRET` (`openssl rand -hex 32`) and
   `VITE_API_BASE_URL=/api`. Remove any other `DATABASE_URL` (for example a Preview one
   pointing at another database).
4. **Deploy**, then open Project → Settings → Cron Jobs, check `/api/demo/reset` is listed
   at `0 19 * * *`, and press **Run** once.
5. **One link.** Keep a single production domain and remove other projects, deployments
   and aliases that serve older versions.

Check it:

```bash
curl -s https://<link>/api/health                                # {"success":true,...}
curl -s https://<link>/api/demo                                  # the demo sign-in
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<link>/api/demo/reset   # rebuilds today's data
```

Profile photo uploads are off on Vercel (the serverless filesystem is read-only), and the
demo account cannot upload one anyway.

## Security notes

- Never commit `.env` files, database URLs or secrets. Use `.env.example` and the Vercel
  dashboard.
- The demo password is published on purpose and works only for an account the API keeps
  read-only. No other account has a usable password.
- Authorisation is enforced by the API on every request, which re-reads the account, its
  role and its manager scope.
- Passwords are stored only as bcrypt hashes (`bcryptjs`).
- `/api/demo/reset` empties the database it runs against. It exists only with
  `DEMO_MODE=true`, needs `CRON_SECRET`, and refuses any database holding people or
  accounts outside the demo's reserved range.
- The audit log never stores passwords, tokens, QR secrets, coordinates or private text.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| "Invalid email or password" | Only `demo@meridian.example` / `meridian-demo` can sign in. |
| "This is disabled in the demo" | Expected: the demo is read-only. |
| The demo shows yesterday as today | The nightly reset did not run. Check Vercel → Cron Jobs, or call `/api/demo/reset` with the secret. |
| `docker compose up` says a port is already allocated | Something else holds 5175, 5003 or 5436. Find it with `docker ps` and stop it. |
| `MIGRATION_DATABASE_URL is required` | The setup scripts never use `DATABASE_URL`. Export the variable and pass a matching `--database`. |
| `/api/health` returns 500 on Vercel | Check the function log; if the stack trace does not name `/var/task/api/index.js`, rebuild with `build:api` and redeploy. |

## Known limitations

- Malaysian statutory payroll (EPF, SOCSO, EIS, PCB) is not automated; the demo shows
  illustrative manual lines.
- Manager scope covers direct reports only, not the whole branch below them.

## License

Developed for educational purposes as a group project.
