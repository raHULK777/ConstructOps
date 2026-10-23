# ConstructOps Engine

Multi-tenant, white-label operations API for mid-sized construction contractors.
One deployment serves many branded workspaces, each resolved from its own domain.

**Stack (fixed by specification):** Node.js 20+ · TypeScript · Express 5 · PostgreSQL · Redis · JWT (HS256)

---

## What is actually verified

| Check | Command | Status |
|---|---|---|
| Strict typecheck (src, scripts, tests) | `npm run typecheck` | passing |
| Behaviour suite — 94 tests | `npm test` | passing |
| Production build | `npm run build` | passing |
| Live HTTP smoke over a real socket | `npm run smoke` | passing |
| Migration DDL executed verbatim | via `tests/support/testDb.ts` | passing (pg-mem) |
| Fail-fast on invalid environment | `node dist/server.js` without env | exits 1 with field names |

**Not yet exercised in this workspace:** a real PostgreSQL cluster, a real Redis
instance, and the migration runner's advisory-lock path. Docker and `psql` are
not installed here. `docker-compose.yml` is provided so those paths can be
verified on a machine that has Docker:

```bash
docker compose up -d
cp .env.example .env          # fill in JWT_SECRET
npm run migrate && npm run seed
npm run dev
```

The automated suite substitutes PostgreSQL with `pg-mem` — which executes the
**real** `migrations/001_tables.sql` and `002_indexes.sql`, including foreign
keys, cascades, checks and unique constraints — and Redis with an in-memory
double that can be forced to fail. All 94 tests drive the real Express pipeline,
real middleware and real SQL.

---

## Quick start

```bash
npm install
cp .env.example .env                 # set DATABASE_URL, REDIS_URL, JWT_SECRET
npm run migrate                      # checksummed, transactional migrations
npm run seed                         # two demo tenants (idempotent)

npm run dev                          # tsx watch, http://localhost:8080
npm run verify                       # typecheck + tests + build + smoke
```

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
migrations/                    000 extensions · 001 tables · 002 indexes
scripts/                       migrate, seed, onboard, smoke
tests/                         support harness + unit + integration suites
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

## API surface

Base path `/api/v1`. All responses are `{ success: boolean, ... }`; errors are
`{ success:false, error, code, requestId }`. Bodies must be
`application/json` (415 otherwise); IDs must be UUIDv4 (400 otherwise).

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/healthz` | public | liveness |
| GET | `/readyz` | public | 503 unless DB **and** Redis answer |
| POST | `/auth/login` | public | tenant resolved from host; returns token + branding |
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

## Operational notes

- **Migrations** are checksummed; editing an applied file aborts the run. A
  PostgreSQL advisory lock prevents concurrent deploys from racing.
- **Redis is optional at runtime.** A read or write failure logs a warning and
  falls back to PostgreSQL; `/readyz` still reports `redis: down` for alerting.
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

---

## Known gaps (next increments)

- No frontend in this repository — this is the API engine the portal consumes.
- Refresh tokens, logout/revocation lists and password reset are not built.
- Transactional email, CSV exports and the operator (platform-superadmin) console
  are out of scope for v1 per `SRS.txt`.
- No OpenAPI document yet; the route table above is the contract of record.
- Real PostgreSQL/Redis integration should be run once via `docker compose`
  before production rollout.
