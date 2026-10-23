# ConstructOps Engine

[![CI](https://github.com/raHULK777/ConstructOps/actions/workflows/ci.yml/badge.svg)](https://github.com/raHULK777/ConstructOps/actions/workflows/ci.yml)

Multi-tenant, white-label construction operations platform: an Express API and a
Next.js portal. One deployment serves many branded workspaces, each resolved from
its own domain.

**Stack:** Node.js 20+ · TypeScript · Express 5 · PostgreSQL · Redis · JWT (HS256) · Next.js 16 · Tailwind

---

## What is actually verified

| Check | Command | Status |
|---|---|---|
| Strict typecheck (src, scripts, tests) | `npm run typecheck` | passing |
| Behaviour suite — 111 tests | `npm test` | passing |
| OpenAPI contract ↔ mounted-route parity | `npm test` | passing |
| Session rotation, reuse detection, logout revocation | `npm test` | passing |
| Production build | `npm run build` | passing |
| Live HTTP smoke over a real socket | `npm run smoke` | passing |
| Portal production build (Next.js 16) | `npm run portal:build` | passing |
| Portal end-to-end over HTTP (login, dashboard, approval, re-theme) | in-memory API + portal build | passing |
| Migration DDL executed verbatim | via `tests/support/testDb.ts` | passing (pg-mem) |
| Real PostgreSQL 16: migrate, re-migrate, seed, onboarding, audit trail | portable cluster, `smoke:live` | passing |
| Real PostgreSQL 16 + Redis 7 (CI `integration` job) | `npm run migrate && npm run seed && npm run smoke:live` | passing in CI |
| One-command local stack (API + portal, no Docker) | `npm run dev:all` | passing |
| Fail-fast on invalid environment | `node dist/server.js` without env | exits 1 with field names |

**Docker:** `docker-compose.yml` and the two Dockerfiles describe the
production-shaped stack, but Docker is not installed in this workspace, so the
image build itself has not been executed here. The one-command runner is the
verified local path; the container path is provided for machines with Docker.

CI runs the fast suite on Node 20 and Node 24, and a separate `integration` job
boots PostgreSQL 16 + Redis 7 services, migrates, seeds, starts the built API and
runs `scripts/smoke-live.ts` against it.

**Local limitation:** this machine has no Docker, WSL, or `psql`. The PostgreSQL
pass above was executed with a portable PostgreSQL 16.4 cluster in `%TEMP%`
(no installer, no service, removed afterwards). Real Redis needs Docker or the CI
run; locally the API was verified with Redis absent, including the documented
`503` readiness degradation and a full `smoke:live` pass in ~1 s.

The automated suite substitutes PostgreSQL with `pg-mem` — which executes the
**real** `migrations/001_tables.sql` and `002_indexes.sql`, including foreign
keys, cascades, checks and unique constraints — and Redis with an in-memory
double that can be forced to fail. All 111 tests drive the real Express pipeline,
real middleware and real SQL.

---

## Quick start

```bash
# Fastest path — no Docker, no PostgreSQL install:
npm install
npm run dev:all                      # API :8080 + portal :3000, seeded demo tenants

# Production-shaped stack (PostgreSQL 16 + Redis 7 + built API and portal):
docker compose up --build            # portal :3000, api :8080

# Manual infrastructure path:
cp .env.example .env                 # set DATABASE_URL, REDIS_URL, JWT_SECRET
npm run migrate                      # checksummed, transactional migrations
npm run seed                         # two demo tenants (idempotent)
npm run dev                          # API only, http://localhost:8080
npm run portal:dev                   # portal only, http://localhost:3000
npm run verify                       # typecheck + tests + build + smoke
```

`npm run dev:all` runs the real API middleware and SQL against a seeded
in-memory PostgreSQL and starts the Next.js dev server. Press `Ctrl+C` to stop
both. It prints the workspace URL and demo credentials when ready.

No PostgreSQL or Redis on your machine? Run the API against an in-memory engine
seeded with the demo tenants — the real middleware and SQL, zero infrastructure:

```bash
npm run dev:memory                   # API on :8080 (pg-mem + seeded demo data)
npm run portal:dev                   # portal on :3000, themed as Alpha Builders
```

The portal talks to the API server-side, so localhost works without tenant DNS
(`TENANT_HOST_OVERRIDE` in `portal/.env.example`, default
`alpha-builders.constructops.test`).

Demo workspaces (all passwords = `SEED_PASSWORD`, default `ChangeMe!123`):

| Host | Company | Change orders |
|---|---|---|
| `alpha-builders.constructops.io` | Alpha Builders Pro | enabled |
| `alpha-builders.example.com` | Alpha Builders Pro (custom domain) | enabled |
| `summit-renovations.constructops.io` | Summit Renovation Group | **disabled** (feature gate demo) |

Seed accounts: `admin@alphabuilders.com`, `field@alphabuilders.com`,
`client@alphabuilders.com`, `admin@summitrenovations.com`,
`client@summitrenovations.com`.

Provision a real customer atomically (tenant + admin, one transaction):

```bash
npm run onboard -- \
  --company "Ironclad Construction" \
  --subdomain ironclad \
  --email owner@ironclad.com \
  --password "a-strong-password" \
  --domain ironclad-builds.com \
  --primary-color "#111827" --secondary-color "#F97316"
```

---

## Request lifecycle

```
Host header
  → requestContext        correlation id + access log
  → helmet / CORS / JSON  (multipart rejected with 415)
  → rate limit            per-IP, stricter on login
  → tenantResolver        Redis lookup → PostgreSQL fallback → req.tenant
  → authenticate          HS256 verify → tenant claim match → DB user re-check
  → requireRole / requireFeature
  → validateBody/Params/Query (Zod)
  → controller → service → repository
  → errorHandler          { success:false, error, code, requestId }
```

`src/` follows the mandated Controller → Service → Repository split:

```
src/
  app.ts                       composition root (createApp(deps))
  server.ts                    boot, readiness probes, graceful shutdown
  config/                      env (Zod), pg pool, ioredis client
  middleware/                  tenantResolver, authenticate, requireRole,
                               requireFeature, rateLimit, errorHandler, CORS
  modules/
    tenant/                    resolution, branding, onboarding
    auth/                      login, token issuance
    project/                   list/get/progress/create/delete
    changeOrder/               create/list/approve/reject
    estimator/                 pricing-matrix quotation
  demo/seed.ts                 demo dataset (used by seed + tests)
  types/                       domain records, Zod contracts, Express augments
  utils/                       asyncHandler, errors, jwt, password, host, uuid
portal/                        Next.js white-label portal (see "Portal" below)
migrations/                    000 extensions · 001 tables · 002 indexes · 003 sessions
scripts/                       migrate, seed, onboard, smoke, dev:all, dev:memory
docs/openapi.yaml              OpenAPI 3.1 contract
tests/                         support harness + unit + integration + contract
Dockerfile.api                 API image (build stage reused for migrations)
Dockerfile.portal              Next.js standalone image
docker-compose.yml             PostgreSQL + Redis + api-setup + API + portal
.github/workflows/ci.yml       verify (Node 20/24) + integration (real PG/Redis)
```

---

## The isolation rule, and how it is enforced

**Single database, shared schema, one partition key: `tenant_id`.**

1. **Structural.** Every operational table has `tenant_id UUID NOT NULL
   REFERENCES tenants(id) ON DELETE CASCADE`. Deleting a tenant deletes its
   entire footprint; UUIDv4 keys prevent sequential guessing across tenants.
2. **Resolved from the domain, never the client.** `tenantResolver` derives the
   tenant from `Host` (Redis `tenant:v1:<host>`, 1 h TTL, 30 s negative cache).
   Requests cannot *choose* a tenant.
3. **Proven twice.** The JWT carries `tenant_id`; `authenticate` rejects a
   mismatch with `403` and the exact message
   `Access token scope does not match current tenant domain context.`
4. **Bound into every statement.** Repositories append `AND tenant_id = $n`
   (parameterised; no string concatenation anywhere). A client-role list is
   further filtered by `client_id` taken from the session, never the query.
5. **Role is authoritative in the database.** A forged `role: "admin"` claim is
   ignored: every authenticated request re-reads `users.role` inside the tenant.
6. **Failures stay opaque.** Cross-tenant IDs return `404`, not `403`; the 403
   body carries no schema or stack information.

Two deliberate hardenings beyond the reference documents:

- **No first-label guessing on foreign domains.** The brief resolves
  `host.split('.')[0] OR custom_domain = host`, which lets `acme.example.com`
  silently match another tenant's `acme` subdomain. Here subdomains are inferred
  only inside `PLATFORM_ROOT_DOMAIN`; every other host must match
  `custom_domain` exactly. Custom-domain matches also win over subdomain matches.
- **Negative caching.** Unknown hosts are cached for 30 seconds so they cannot be
  used to amplify database load.

---

## Authentication & sessions

- **Access token** — HS256 JWT, 15 minutes, claims `sub`, `tenant_id`, `role`,
  `email`, `sid` (session id). Short by design: it is the only credential the
  data endpoints accept.
- **Refresh token** — 256-bit opaque value, 30 days, stored as a SHA-256 hash in
  `auth_sessions` and returned only to the client that logged in.
- **Rotation** — every `/auth/refresh` revokes the presented session and issues a
  new pair. Replaying a consumed token is treated as theft: every session for
  that user is revoked.
- **Immediate revocation** — `authenticate` joins the session row on `sid` and
  rejects revoked or expired sessions, so logout kills the access token at once
  rather than at expiry.
- **Portal** — both tokens live in `httpOnly`, `SameSite=Lax` cookies; a
  `SessionKeeper` client component refreshes at 10 minutes, and route handlers
  rotate or revoke on the server. The browser never sees a token.
- **Knobs** — `JWT_EXPIRES_IN` (default `15m`), `REFRESH_TOKEN_TTL_DAYS`
  (default `30`). Expired rows are inert; prune them with a scheduled
  `DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days'`.

---

## API surface

Base path `/api/v1`. All responses are `{ success: boolean, ... }`; errors are
`{ success:false, error, code, requestId }`. Bodies must be
`application/json` (415 otherwise); IDs must be UUIDv4 (400 otherwise).

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/healthz` | public | liveness |
| GET | `/readyz` | public | 503 unless DB **and** Redis answer |
| POST | `/auth/login` | public | returns short-lived access token + rotating refresh token |
| POST | `/auth/refresh` | public | single-use rotation; replay revokes the whole session family |
| POST | `/auth/logout` | public | revokes the session; its access token stops working immediately |
| GET | `/tenant/branding` | public | theme tokens; never exposes pricing or IDs |
| PUT | `/tenant/branding` | admin | colours, logo, typography, radius; invalidates cache |
| POST | `/tools/estimate` | public, `enable_estimator` | tenant pricing matrix |
| GET | `/projects` | all roles | clients see only their own |
| POST | `/projects` | admin | validates `clientId` belongs to this tenant |
| GET | `/projects/:id` | all roles | opaque 404 for another client's project |
| PUT | `/projects/:id/progress` | admin, field_staff | only phase + percentage |
| DELETE | `/projects/:id` | admin | cascades change orders |
| GET | `/change-orders` | all roles, `enable_change_orders` | clients see only their projects |
| POST | `/change-orders` | admin, field_staff | always created `pending` |
| GET | `/change-orders/:id` | all roles | client-scoped join |
| PUT | `/change-orders/:id/approve` | **client only** | records `signed_by`, `signed_at`, IP |
| PUT | `/change-orders/:id/reject` | admin | pending only |

Role matrix is enforced route-by-route (`Security-policy.md`, §4):

| Role | May do |
|---|---|
| `admin` | everything inside its tenant (projects, branding, rejections) |
| `field_staff` | read tenant data; update project phase/progress; create change orders |
| `client` | read own projects; approve change orders on own projects |

Change-order approval is deliberately narrow: `client` only, ownership proven by
a join against `projects.client_id`, and the `UPDATE` only succeeds while
`status = 'pending'` — so a double click returns `409`, never two signatures.

The machine-readable contract is [`docs/openapi.yaml`](docs/openapi.yaml)
(OpenAPI 3.1). It is not decorative: `tests/contract/openapi.test.ts` fails if a
documented operation is not mounted, if an operation lacks an id/summary/tags or
a 2xx response, or if a protected route forgets to declare bearer security.

---

## White-labeling

Every tenant row carries colours, logo, feature flags and a `branding_config`
JSONB document:

```json
{
  "typography": { "font_family": "Manrope", "base_size": "16px" },
  "layout": { "navbar_style": "solid", "sidebar_position": "left", "border_radius": "0.5rem" },
  "assets": { "favicon_url": "...", "email_banner_url": "..." }
}
```

`GET /api/v1/tenant/branding` is what the frontend shell reads before login; it
maps the config into the CSS custom properties from the visual specification
(`--primary-color`, `--secondary-color`, `--brand-radius`, `--brand-font`).
Partial updates merge with the stored config, and a successful `PUT` deletes the
tenant's cache keys (subdomain + `www` variant + custom domain) so the next
request re-reads PostgreSQL. Malformed JSONB in the database degrades to
platform defaults instead of failing requests.

Feature flags (`enable_estimator`, `enable_client_portal`,
`enable_change_orders`) are read from the resolved tenant and never from the
token or body — flipping a paid module is a data change, not a deploy.

---

## Portal (Next.js)

`portal/` is the workspace UI the contractor and their client actually use.

- **Runtime theming.** The root layout reads `GET /api/v1/tenant/branding` on
  every request (never at build time), injects the tenant's colour, radius and
  font as CSS custom properties on `<html>`, and Tailwind binds utilities to
  those variables. A branding change re-skins the portal on the next navigation,
  with no rebuild and no redeploy.
- **Tokens stay server-side.** Login goes through `POST /api/session`, which
  exchanges credentials with the API and stores the JWT in an `httpOnly`,
  `SameSite=Lax` cookie. The browser never holds the token; server components
  read the cookie and route handlers (`/api/projects/:id/progress`,
  `/api/change-orders/:id/approve`, `/api/branding`) forward it. There is no
  wildcard proxy.
- **Tenant by host.** In production the incoming `Host` is forwarded to the API,
  so the portal and API resolve the same tenant. On localhost the configured
  `TENANT_HOST_OVERRIDE` is used instead.
- **Role-aware, not role-authoritative.** Navigation and controls follow the
  claims in the session (Branding is admin-only, the signature button is
  client-only), but every decision is re-checked by the API. The portal decodes
  the JWT for display only; it does not verify it.
- **Pages.** `/login` → `/dashboard` (portfolio stats, project cards) →
  `/dashboard/projects/[id]` (phase, progress, change orders, signature) →
  `/dashboard/branding` (admin editor with live preview).

```bash
npm run portal:dev      # http://localhost:3000
npm run portal:build    # production build
npm run portal:start    # serve the build on :3000
```

Verified end-to-end over HTTP against the in-memory API: admin login, themed
dashboard with real project data, progress update form, client signature with
recorded audit trail, rejection of a second signature, and a live re-theme after
`PUT /api/branding`.

---

## Operational notes

- **Migrations** are checksummed; editing an applied file aborts the run. A
  PostgreSQL advisory lock prevents concurrent deploys from racing. The migration,
  seed and onboarding tools are TypeScript (`tsx`), so run them from a release job
  that installs dev dependencies (`npm ci --include=dev`); the long-running server
  itself only needs `npm ci --omit=dev` plus the compiled `dist/`.
- **Redis is optional at runtime.** The client uses `enableOfflineQueue: false`
  and `maxRetriesPerRequest: 1`, so a down cache fails in milliseconds instead of
  stalling on the socket timeout. `tenantResolver` also pauses cache access for
  10 s after a failure (a small circuit breaker), so one outage costs one warning
  rather than one per request. `/readyz` still reports `redis: down` for alerting.
  This behaviour was found and fixed during the real-PostgreSQL pass — the fake
  Redis double failed instantly and had hidden the latency.
- **PostgreSQL is mandatory**; boot exits 1 if it cannot be reached.
- **Graceful shutdown** on SIGINT/SIGTERM: stop accepting, drain, close pool,
  quit Redis, force-exit after 10 s.
- **Rate limits** are configurable and disabled under `NODE_ENV=test`.
- **Trust proxy** must be set correctly (`TRUST_PROXY`) or the recorded client
  IP in the audit trail will be the proxy address. `clientIp()` validates with
  `net.isIP` and strips IPv4-mapped IPv6 prefixes.

---

## Deliberate deviations from the written brief

| Change | Why |
|---|---|
| Subdomain inference restricted to the platform root | prevents custom-domain/subdomain cross-tenant collisions |
| `NOT NULL` added to boolean flags, timestamps, cost columns | avoids tri-state data in a financial system |
| `idx_projects_tenant_client` added | the client portal always filters `(tenant_id, client_id)` |
| Onboarding validates inside the service, not just the CLI | service must not trust its caller with a tenant boundary |
| Admin `reject` endpoint added | the brief defines approve only; drafts need an exit that is not a delete |
| Project `POST` / `DELETE` added | RBAC grants admin full authority; the route matrix omitted the verbs |
| Error envelope adds `code` + `requestId` | machine-readable failures and log correlation; `error` stays first-class |
| `404` (not `403`) for another client's record | avoids confirming that a foreign record exists |
| `409` on double approval | the second signature is a conflict, not a silent success |
| Portal proxies API calls server-side | keeps the JWT out of JavaScript and preserves Host-based tenant resolution |
| Portal decodes (does not verify) the JWT for UI gating | the API remains the only authorisation authority |

---

## Known gaps (next increments)

- Portal has no automated browser suite yet — the end-to-end flow was verified
  with real HTTP requests against the built app, not a headless browser.
- Password reset, MFA and a "manage my sessions" UI are not built. Logout and
  refresh rotation are implemented; the JWT itself is short-lived by design.
- Transactional email, CSV exports and the operator (platform-superadmin) console
  are out of scope for v1 per `SRS.txt`.
- Real PostgreSQL/Redis integration is covered by CI; run it locally with
  `docker compose` if you want the same shape on your machine.
