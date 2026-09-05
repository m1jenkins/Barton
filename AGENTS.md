# AGENTS.md

## Cursor Cloud specific instructions

Drive Right is a static marketing site (60+ HTML pages served from the repo root, e.g. `index.html`, `austin.html`, `schedule.html`) plus a set of Node.js serverless API functions in `api/*.js`. Production runs on Vercel (see `vercel.json`); the API is backed by PostgreSQL and Stripe. There is no build step — the site is plain HTML/CSS/JS.

### Services

- Static site + API: served together in local dev by `scripts/dev-server.mjs` (added for local dev; Vercel does this in production). It serves static files and dispatches `/api/<name>` to the default export of `api/<name>.js`.
- PostgreSQL: source of truth for the API (leads, checkout attempts, purchases, onboarding). Required for any `/api/*` DB call. Schema lives in `db/001_durable_leads_and_payments.sql`.
- Stripe: only needed for checkout / webhook / purchase-status / onboarding flows. Not needed for the lead-capture flow (`/api/leads`).

### Lint / test / build

- Tests: `npm test` (Node built-in test runner; no DB/Stripe needed).
- Lint / syntax check: `npm run check:api` (runs `node --check` on every API file).
- Site validation: `node scripts/validate-site.mjs` (checks HTML/sitemap invariants; acts as the site "lint").
- No build/bundling step exists.

### Running the app locally

1. `PORT=8080 node scripts/dev-server.mjs` serves everything on `http://localhost:8080`.
2. The dev server auto-loads a local `.env` (gitignored). For the DB-backed API set `DATABASE_URL` there.
3. `APP_ORIGIN` must match the origin you browse from. When it (or `ALLOWED_ORIGINS`) is unset and `NODE_ENV` is not `production`, the API allows `http://localhost:3000` and `http://localhost:8080` by default. State-changing endpoints require an exact `Origin` header, JSON body, and an `Idempotency-Key` header (8–128 chars); the browser JS in `script.js` already sends these.

### PostgreSQL setup (needed only for API/lead testing)

Not part of the startup update script (it installs system packages / applies a migration). Run once per fresh VM if you need the API:

```sh
sudo apt-get update && sudo apt-get install -y postgresql postgresql-client
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE driveright LOGIN PASSWORD 'driveright';"
sudo -u postgres createdb -O driveright driveright
PGPASSWORD=driveright psql -h 127.0.0.1 -U driveright -d driveright -f db/001_durable_leads_and_payments.sql
```

Then in `.env`: `DATABASE_URL=postgresql://driveright:driveright@127.0.0.1:5432/driveright` and `APP_ORIGIN=http://localhost:8080`.

The lead-capture flow (submit any page's Contact form → `POST /api/leads` → row in `leads`) works with just PostgreSQL. Leave `TURNSTILE_SECRET_KEY` unset in dev, otherwise lead submissions intentionally fail (no client widget is wired up).

### Gotchas

- `package.json` declares `engines.node = 24.x`, but the sandbox-managed default `node` is v22.x (first on `PATH` at `/exec-daemon/node`). The codebase uses only standard features and runs fine on Node 22; `npm install` prints a harmless `EBADENGINE` warning. Do not fight `PATH` to force Node 24.
- Stripe env vars (`STRIPE_SECRET_KEY`, `STRIPE_PAYMENT_LINK_*_URL`, `STRIPE_WEBHOOK_SECRET`) are required only for checkout/webhook/onboarding/purchase-status; those flows need real Stripe credentials to test.
