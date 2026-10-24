# Public Website Plan — ConstructOps

**Status:** draft for approval · **Owner:** product/engineering · **Date:** 2026-10-24

This plan turns the authenticated portal into a public-facing, white-label business
website that helps each contractor attract and convert local customers. It is a
plan, not an implementation. No marketing routes are built yet.

---

## 1. Executive summary

The portal already does the hard operational work: projects, stages, budgets,
change orders, customer approvals, comments and white-label branding. What is
missing is the **shop window**: a fast, credible, mobile-first website a
homeowner or facilities manager lands on before they ever hear about the portal.

**Recommendation:** build the public site *inside the existing Next.js app*, as a
route group served at the tenant's host root. One deployment, one design system,
tenant branding reused automatically, and the private portal untouched at
`/dashboard`. Phase 1 ships a complete lead-generation site for the demo tenant;
later phases add the estimator wizard, case studies, local landing pages, a leads
inbox, and finally the platform's own marketing site at the apex domain.

**Why this order:** the tenant site is what grows the contractor's business (the
stated goal), and it exercises the same branding/content architecture the
platform site will later reuse.

### The one-sentence positioning

> **ConstructOps gives contractors a website that turns visitors into signed
> projects, and a portal that delivers them without the paperwork.**

---

## 2. Surfaces, scope and host model

There are two possible "public websites". This plan separates them so the scope
never blurs.

| Surface | Host | Audience | Phase |
|---|---|---|---|
| **Tenant marketing site** | `alpha-builders.constructops.io`, custom domains | The contractor's prospective customers (homeowners, property managers) | **1** |
| **Platform marketing site** | `constructops.io` (apex) | Contractors deciding whether to buy ConstructOps | 4 (reuses components) |

### Host behaviour after this work

```
tenant host (any domain)
  /                     → public marketing home (this plan)
  /services, /projects  → public marketing pages
  /estimate             → public estimator + lead capture
  /about, /contact      → public pages
  /login                → portal sign-in (existing)
  /dashboard/*          → private portal (existing, session required)
  /forgot-password      → recovery (existing)
  /api/*                → server-side proxies to the API

platform apex
  phase 1–3: a waitlist page (or redirect to the demo tenant)
  phase 4:   the platform marketing site
```

**Decision:** `/` stops redirecting to `/login`. Marketing pages are public; the
portal stays behind auth. Signed-in users still see a "Client portal" link in the
header. This is a behaviour change worth stating in the release notes.

---

## 3. Goals and measurement

### Business goals

1. Generate qualified enquiries for the contractor: calls, estimate requests and
   walkthrough bookings.
2. Make the contractor look established and trustworthy within five seconds.
3. Turn "how much will it cost?" anxiety into a transparent range and a form
   submission.
4. Give every tenant a credible site on day one, without a designer.

### Website KPIs (90 days after launch)

| Metric | Target | Measured by |
|---|---|---|
| Visitor → lead conversion | ≥ 3.5% of sessions | analytics event `lead_submit` |
| Estimate starts → completions | ≥ 40% | `estimate_start`, `estimate_complete` |
| Mobile LCP (p75, field) | ≤ 2.0 s | CrUX / RUM |
| INP (p75) | ≤ 200 ms | CrUX / RUM |
| CLS (p75) | ≤ 0.05 | CrUX / RUM |
| Lighthouse mobile (lab) | perf ≥ 95, a11y 100, SEO 100 | CI |
| Sticky call/estimate tap-through | tracked baseline in week 2 | `cta_click` |
| Bounce on home (mobile) | ≤ 55% | analytics |

Vanity metrics are explicitly out of scope: page views, time on site, and
"impressions" do not decide whether this works.

---

## 4. Audience and jobs to be done

### Primary: the property owner

- 30–60, researching on a phone in the evening, comparing two or three
  contractors, often after a life event (new house, growing family, insurance
  claim).
- They are not evaluating "craftsmanship". They are evaluating **risk**: Will you
  show up? Will the price hold? Who is accountable when something goes wrong?

| Job | What the site must answer |
|---|---|
| "Can I trust this company?" | Licence, insurance, real projects, real names, warranty |
| "What will it cost?" | Transparent ranges and a 60-second estimator |
| "How long will it take?" | Process with realistic durations, current availability |
| "Do you work here?" | Service-area page with local proof |
| "What happens next?" | A clear 3-step path from enquiry to proposal |

### Secondary: the facilities manager

- Wants commercial build-out language, after-hours constraints, insurance
  certificates, and references. Same template, a `/commercial` service entry and
  case study filters.

### Explicit non-audience

- DIY homeowners looking for tutorials. Content should not chase that traffic; it
  converts poorly and dilutes local SEO.

---

## 5. Messaging and copy system

Voice: **direct, specific, calm.** Short sentences. Numbers where they are true.
No "quality craftsmanship", "dream home", "passion for excellence", or "family-owned
since forever" without a concrete fact beside it.

### Message hierarchy

1. **Outcome** — the space works, the schedule holds.
2. **Proof** — licence, insurance, years, projects, named reviews.
3. **Process** — what the first two weeks look like.
4. **Price transparency** — a range, not a mystery.
5. **Low-risk next step** — a 15-minute call or a 48-hour estimate.

### Copy rules (from the prose standard)

- Sentence case for all UI and headings; capitalise only the first word and
  proper nouns.
- One idea per sentence; one primary CTA per section.
- CTAs are verbs: "Get my estimate", "Book a walkthrough", "Call the office".
- Every claim is complete: "Licensed and insured in [state], licence #…" not
  "fully licensed".
- Errors are plain and actionable: "We couldn't send that. Check your connection
  and try again, or call (555) 010-2030."
- No paragraph longer than three lines on mobile.

### Hero copy options (pick per tenant, editable)

| Slot | Option A (recommended default) | Option B |
|---|---|---|
| H1 | Builds that hold up. Timelines that hold true. | Your project, finished the way we quoted it. |
| Sub | Kitchens, additions and commercial build-outs across [metro]. Licensed, insured, and on site when we say. | Fixed-scope proposals in 48 hours. Weekly progress you can check from your phone. |
| Primary CTA | Get my estimate | See what we build |
| Secondary | See recent projects | Call (555) 010-2030 |

Trust strip: `Licensed & insured · 18 years · 240+ projects · 4.9★ (37 reviews)` —
all values tenant-provided, never invented.

Service line format: **outcome + scope + constraint**, e.g.:

> **Kitchen remodels.** Layout changes, permits, cabinets and trades under one
> contract. Most kitchens take 6–9 weeks on site.

---

## 6. Information architecture and sitemap

```
/                         Home
/services                 Services index
/services/[slug]          Service detail (kitchens, additions, commercial, …)
/projects                 Project gallery with filters
/projects/[slug]          Case study
/estimate                 Estimator wizard (lead magnet)
/about                    Company, owner, team, credentials
/reviews                  Reviews and ratings (phase 2)
/areas/[city]             Local landing page (phase 2, real areas only)
/contact                  Contact + walkthrough request
/privacy, /terms          Legal
/login, /dashboard        Private portal (existing)
```

Navigation (desktop): `Services · Projects · About · Reviews · Contact` + phone +
**Get my estimate**. Mobile: logo, phone icon, menu button; sticky bottom bar with
**Call** and **Free estimate**.

Footer: company name, licence number, address, hours, phone/email, service areas,
privacy/terms, "Client portal" link, review link.

---

## 7. Page blueprints

### 7.1 Home (the conversion page)

Desktop:

```
┌ header: logo | Services Projects About Reviews | phone | [Get my estimate] ┐
│ HERO — full-bleed project photo, dark gradient                            │
│   H1 (2 lines max)                                                        │
│   Sub (1–2 lines)                                                         │
│   [Get my estimate]  [See recent projects]                                │
│   Licensed & insured · 18 years · 240+ projects · 4.9★                    │
├ trust bar (licence, warranty, insurance, review source) ─────────────────┤
│ Services — 3 cards: outcome headline, 2-line scope, "See details →"       │
├ Featured project — image left / story right (scope, duration, result) ────┤
│ Process — 4 steps with real durations                                     │
├ Estimator band — "Know your range in 60 seconds" + CTA ───────────────────┤
│ Testimonials — 2 quotes with name, neighbourhood, project type            │
├ Service area — city list with one line of local proof ────────────────────┤
│ FAQ — 6 questions, native <details>                                       │
├ Final CTA — phone + estimate ─────────────────────────────────────────────┤
└ footer ───────────────────────────────────────────────────────────────────┘
```

Mobile order: hero → trust strip → sticky CTA → services → featured project →
process → estimator → testimonials → areas → FAQ → final CTA → footer.

Rules:

- Hero image is the LCP element: `next/image`, `priority`, AVIF, width 1600, no
  client-side animation over it.
- H1 must be readable over the photo at 390 px; use a gradient scrim, not text
  shadow.
- No auto-rotating carousel. Featured projects are static cards; motion only on
  reveal and hover (`@media (hover: hover)`).

### 7.2 Services index and detail

- Index: 4–6 services, each with an image, an outcome line and a "from" range if
  the tenant provides one.
- Detail template: breadcrumb → H1 → 1-paragraph problem statement → "What's
  included" bullets → process/timeline → price range and what changes it →
  3-project gallery → 2 FAQs → CTA.
- Each service page targets one intent ("kitchen remodel [city]"), not a keyword
  list.

### 7.3 Projects and case studies

- Gallery cards: cover image, project type, city, year, one-line result.
- Filters: type + city (client-side, no reload).
- Case study: hero → facts table (location, type, duration, budget band) →
  challenge → approach → result → gallery → customer quote → CTA.
- Images lazy-load below the fold; gallery lightbox is keyboard accessible and
  dismissible with Escape.

### 7.4 Estimator (the lead magnet)

Three steps, one question per screen, progress visible:

1. **Project** — type (kitchen, bath, addition, commercial, other), postcode.
2. **Scope** — size band, finish tier, target start.
3. **Contact** — name, email, phone, optional note, consent.

Result screen: a range (from the tenant's existing `estimator_pricing_matrix`),
what moves the price, and one CTA: **Book a 15-minute call**. Copy must state
that the range is indicative, not a quote. The lead is saved only at step 3, with
the answers attached.

### 7.5 About, reviews, areas, contact

- **About:** owner photo and story (2 paragraphs), licence/insurance, years,
  team, safety, warranty, community. No stock "handshake" photos.
- **Reviews:** 6–12 real quotes, source attribution (Google/Facebook), average
  and count, link to the profile. Schema `aggregateRating` only when the reviews
  are genuine and displayed.
- **Areas:** one page per real service city: unique intro, projects in that city,
  travel/response note, local CTA. No thin doorway pages.
- **Contact:** form (name, email, phone, project type, message, consent),
  phone, hours, response-time promise ("We reply within one business day"),
  optional map, and the same form as the estimator's final step.

### 7.6 Legal and system pages

Privacy (lead data, analytics, cookies), terms, thank-you page with next steps
and response expectation, 404 with search/links, and an offline/error state.

---

## 8. Design direction

The site should feel like a **well-run construction firm**, not a SaaS landing
page: editorial, photographic, confident, quiet.

### 8.1 Anti-patterns (explicit)

- Purple/blue gradient hero with floating dashboard mockups.
- Three identical icon cards with generic labels.
- Auto-playing video, parallax that breaks mobile, cursor effects.
- Stock photos of men in hard hats pointing at nothing.
- More than two font families, more than three weights per page.
- Text over busy photos without a scrim.

### 8.2 Visual language

- **Layout:** 12-column grid, max width 1280 px, asymmetric editorial splits
  (60/40), generous whitespace, full-bleed photography.
- **Photography:** real projects, natural light, warm grade, 3:2, in-progress and
  finished, people working. Never stock for a real tenant; demo may use
  licence-cleared stock and must be labelled as sample work.
- **Texture:** paper-warm neutrals (`#F6F3ED`), deep ink (`#0B1220`), thin rules,
  subtle grain only if it costs no bytes.
- **Accent:** the tenant's secondary colour, used for CTAs, links and small
  markers — never for large text surfaces without a contrast check.
- **Iconography:** inline SVG, 1.5 px stroke, 24 px, drawn from one set.

### 8.3 Tokens

| Token | Default | Notes |
|---|---|---|
| `--ink` | `#0B1220` | body text, headings |
| `--paper` | `#F6F3ED` | page background |
| `--surface` | `#FFFFFF` | cards, forms |
| `--muted` | `#E7E2D9` | borders, dividers |
| `--accent` | tenant secondary (`#3B82F6` default) | CTA fill |
| `--accent-ink` | computed | `readableTextColor(accent)` |
| `--radius` | tenant `border_radius` | cards, buttons, inputs |
| `--font-body` | tenant font / Inter | 400/500 |
| `--font-display` | Fraunces | 550–600, optical sizing |
| `--shadow-card` | `0 1px 2px rgb(11 18 32 / .06)` | no heavy shadows |
| `--section-y` | 96 / 64 / 40 px | desktop / tablet / mobile |

Contrast: every ink/surface pair ≥ 4.5:1; CTA text uses the computed accent ink;
focus ring uses `--accent` at 2 px with 2 px offset and must be visible on both
paper and photography.

### 8.4 Motion

- 150–250 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Allowed: 12 px reveal on enter, 2 px card lift on hover, underline grow, drawer
  slide, image scale ≤ 1.02.
- Forbidden: parallax, scroll-jacking, autoplay, counters that animate before the
  value is readable.
- `prefers-reduced-motion: reduce` removes transforms and transitions.

### 8.5 Component inventory

`SiteHeader`, `MobileNav`, `StickyCTA`, `Hero`, `TrustStrip`, `ServiceCard`,
`ProjectCard`, `CaseStudyHero`, `ProcessSteps`, `EstimatorTeaser`,
`TestimonialCard`, `AreaList`, `FaqAccordion`, `CtaBand`, `SiteFooter`,
`EstimateWizard`, `LeadForm`, `FormField`, `StatusNotice`, `Lightbox`.

All reuse the existing brand tokens; no parallel colour system.

---

## 9. Responsive behaviour

Acceptance baseline: **390 CSS px** (test 360 as well), no horizontal scroll, no
clipped primary actions, no hover-only affordances.

| Breakpoint | Layout |
|---|---|
| < 640 | single column, drawer nav, sticky bottom CTA, 16 px inputs, 44 px targets |
| 640–1023 | 2-column service/project grids, inline nav still hidden |
| 1024–1279 | 12-col layout, header nav visible, 3-column grids |
| ≥ 1280 | max-width container, editorial splits, larger display type |

Rules taken from the responsive skill:

- Adjust space/wrapping **before** truncating or hiding. Primary actions never
  disappear.
- Card titles wrap naturally; never truncate key information. Truncation is only
  for tabs/labels, and the full value must remain reachable.
- Icon-only controls (phone, menu) require an accessible name and a tooltip only
  where it helps; on touch, tapping performs the action directly.
- Hover styles live under `@media (hover: hover)`; touch leaves no sticky hover
  state.
- Inputs are 16 px under `(pointer: coarse)` to prevent iOS focus zoom; no
  auto-focusing the keyboard on load.
- Focus is preserved across width changes; the drawer traps focus, closes on
  Escape and route change, and returns focus to the trigger.
- Sticky CTA sits above the safe-area inset and never covers form fields or the
  footer's legal links.

Wireframe (mobile home):

```
┌ logo            ☰ ┐
│ HERO photo        │
│ H1 (3 lines max)  │
│ sub (2 lines)     │
│ [Get my estimate] │
│ See recent work → │
│ ✓ licensed ✓ 18yr │
├ services (stack)  │
├ featured project  │
├ process steps     │
├ estimate band     │
├ testimonials      │
├ areas             │
├ FAQ               │
├ final CTA         │
├ footer            │
└ [Call] [Estimate] ┘  ← sticky
```

---

## 10. Accessibility (WCAG 2.2 AA)

- Semantic landmarks, one H1 per page, ordered headings.
- Skip-to-content link; visible focus everywhere; no keyboard traps.
- Mobile menu: `aria-expanded`, focus trap, Escape, focus return.
- Forms: visible labels, `autocomplete`, inline error text tied with
  `aria-describedby`, an error summary at submit, no colour-only errors.
- Images: descriptive alt text for project photos; decorative images empty alt.
- Video (if added): captions, no autoplay, pause control.
- Controls ≥ 24×24 px (44×44 for primary actions on touch).
- Motion respects `prefers-reduced-motion`; no flashing content.
- Test: axe in Playwright on home, services, project, estimate and contact at
  390 and 1440; manual keyboard pass on the drawer and estimator.

---

## 11. Performance budgets

| Metric | Lab budget | Field target (p75) |
|---|---|---|
| LCP | ≤ 1.8 s (mobile, 4G) | ≤ 2.0 s |
| INP | — | ≤ 200 ms |
| CLS | ≤ 0.05 | ≤ 0.05 |
| TBT | ≤ 200 ms | — |
| First-load JS | ≤ 120 KB gzip | — |
| Hero image | ≤ 180 KB AVIF | — |
| Fonts | ≤ 2 families, ≤ 4 files, `swap` | — |
| Third-party JS | analytics only, deferred | — |

Implementation rules:

- Server components by default; client JS only for the drawer, estimator, form
  validation and gallery filter.
- `next/font` with subsetting; preload only the two fonts actually used above the
  fold.
- Hero: `next/image` `priority` + `fetchPriority="high"`, explicit dimensions,
  AVIF/WebP; below-fold images lazy with `sizes`.
- No animation libraries; CSS transitions only.
- Marketing pages are cached at the CDN per Host with
  `s-maxage=300, stale-while-revalidate=86400`; tenant lookups hit Redis first.
- Lighthouse CI runs on home, service detail and estimate with hard assertions;
  regressions fail CI.

Because the performance skill insists on measured evidence, the plan includes a
baseline run **before** design polish and a measurement card for each optimization
(workload, clock, budget, exclusions). Backend latency and browser paint are
measured separately.

---

## 12. SEO and local search

- **Per-host metadata**: title template `{Page} · {Company} · {City}`, unique meta
  descriptions, canonical URLs on the tenant's primary host, `robots.txt` and
  `sitemap.xml` generated per host.
- **Structured data**: `GeneralContractor`/`LocalBusiness` with name, phone,
  address, area served, opening hours, sameAs; `Service`, `Project`/`CreativeWork`,
  `FAQPage`. `aggregateRating` only with genuine displayed reviews.
- **Local pages**: only for real service areas; ≥ 300 unique words, local
  projects, response notes. No doorway pages.
- **Internal links**: service ↔ project ↔ area cross-links with descriptive
  anchors.
- **Content plan (first 12 briefs)**: kitchen remodel cost, addition timeline,
  permits, choosing a contractor, commercial build-out checklist, signs you need
  a structural review, etc. Each with a real author and date.
- **Google Business Profile**: link, NAP consistency, review request email sent
  after project completion (phase 3).
- **Avoid**: keyword stuffing, duplicate tenant content across cities, hidden
  text, doorway pages, fake reviews.

---

## 13. Conversion architecture and lead handling

Every page has exactly one primary action, repeated in header, hero and final CTA.

```
Visitor
  ├── phone tap ──────────────► call (tel: link, tracked)
  ├── estimate ─► wizard ─────► lead (POST)
  ├── contact ──► form ───────► lead (POST)
  └── project ──► case study ─► CTA
```

**Lead pipeline (phase 1):**

1. Form validates client-side and server-side (Zod).
2. Portal route handler forwards to `POST /api/v1/public/leads` with the tenant
   Host — the API is never exposed to the browser.
3. API: rate limit 5/hour/IP, honeypot field, minimum time-to-submit, tenant from
   host, store in `leads`, email the tenant contact via the mailer, return a
   generic success.
4. Thank-you page states exactly what happens next and when.
5. Phase 3 adds a `/dashboard/leads` inbox (status: new, contacted, quoted, won,
   lost) and CSV export.

**Spam:** no CAPTCHA at launch (friction); escalate to Cloudflare Turnstile if
abuse appears. Never silently drop a lead; failures show an actionable message
and the phone number.

**Consent and privacy:** explicit checkbox for contact, privacy link, no
pre-ticked boxes. Lead PII is visible only to the tenant's staff (phase 3 inbox);
it is never sent to analytics. Retention is 24 months by default, with CSV
export audited. The privacy page states all of this.

---

## 14. Technical plan

### Route structure (Next.js App Router)

```
portal/app/
  (marketing)/
    layout.tsx               marketing shell (header/footer), tenant branding
    page.tsx                 home
    services/page.tsx
    services/[slug]/page.tsx
    projects/page.tsx
    projects/[slug]/page.tsx
    estimate/page.tsx
    about/page.tsx
    contact/page.tsx
    privacy/page.tsx
    terms/page.tsx
  dashboard/…                existing portal routes (unchanged)
  login/, forgot-password/, reset-password/   existing
  sitemap.ts, robots.ts      per-host metadata routes
  api/lead/route.ts          public proxy to the API
```

`/` currently redirects to `/login`; that file moves into the marketing group.
Nothing else in the portal moves: `/dashboard`, `/login` and the recovery pages
keep their URLs and guards.

### Tenant isolation on public pages

Every marketing read is host-scoped: content, projects, testimonials and area
lists are fetched for the resolved tenant only. Tests cover two tenants on
different hosts to prove no content or lead crosses over. The public content
endpoint never returns pricing, internal IDs, user data or unpublished drafts.

### Data model

```sql
-- 006_public_site.sql
ALTER TABLE tenants ADD COLUMN site_content JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN contact_email TEXT;
ALTER TABLE tenants ADD COLUMN contact_phone VARCHAR(30);
ALTER TABLE tenants ADD COLUMN licence_number VARCHAR(80);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  message TEXT,
  project_type VARCHAR(60),
  budget_range VARCHAR(40),
  source_page VARCHAR(120),
  utm JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','quoted','won','lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent VARCHAR(255)
);
CREATE INDEX idx_leads_tenant_created ON leads(tenant_id, created_at DESC);
```

`site_content` is validated with a Zod schema, merged over defaults derived from
tenant branding, and cached in Redis like tenant metadata. Phase 1 seeds the demo
tenant; phase 3 adds the admin editor.

### Content types

- Hero, trust facts, services, projects/case studies, testimonials, areas, FAQ,
  about, contact, legal.
- Every string is tenant-authored in phase 3; the MVP uses a reviewed default
  template with clearly marked sample projects for the demo tenant.

### Public API additions

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/public/leads` | public (tenant host) | store + notify |
| GET | `/api/v1/tenant/site` | public | public site content (branding + content, no pricing) |
| POST | `/api/v1/tools/estimate` | public, feature-gated | existing estimator |

Rate limiting and validation are identical to the existing public endpoints.

### Caching and rendering

- Marketing pages dynamic per Host, cached at CDN with `s-maxage`.
- Tenant lookup via the existing Redis cache.
- `revalidate = 300` for content; the branding update invalidates the tenant key.
- No personalisation on public pages (keeps them cacheable).

### Analytics and consent

- Cookieless, privacy-first analytics (Plausible or Umami, self-hosted).
- Events: `cta_click{location}`, `call_click`, `lead_submit`, `estimate_start`,
  `estimate_step`, `estimate_complete`, `portal_login_click`.
- No ad pixels at launch. If added later, they sit behind consent.

### Testing

- Playwright: home, service, project, estimate, contact at 390×844 and 1440×900;
  nav drawer focus; sticky CTA; form validation and success; axe checks.
- Lighthouse CI budgets (perf ≥ 95 mobile, a11y 100, SEO 100).
- Link checker and HTML validation.
- Visual snapshots after the design locks.
- Seed a `site_content` fixture so tests are deterministic.

### Images and assets

- Tenant-supplied project photos via URL in phase 1; upload + storage in phase 3.
- Deterministic sizes (1600/1200/800/480 AVIF+WebP), `sizes` set per slot.
- OG image generated per host from branding (`next/og`) with the company name and
  accent colour.
- Favicon and logo come from the existing branding config.

---

## 15. Content model and admin (phase 3)

- Admin page `/dashboard/site`: edit hero, services, projects, testimonials,
  areas, contact, legal.
- Draft/publish, with a preview URL (signed, short-lived).
- Validation: required fields per section, image URL checks, no HTML injection.
- Content versioning: `site_content_versions` table (optional) for rollback.
- Leads inbox with status changes and CSV export.

Until phase 3, content is seeded via a reviewed JSON fixture for the demo tenant;
the public site must still look complete.

---

## 16. Roadmap and acceptance criteria

### Phase 0 — design lock (2 days)

- Tokens, type scale, component inventory, two home directions, copy deck.
- Acceptance: design review against this document; no open visual questions.

### Phase 1 — MVP site (4–5 days)

- Route group, marketing shell, home, services index/detail (4 services),
  projects gallery (6 sample projects), about, contact, privacy/terms, 404.
- Lead API + form + thank-you page; email notification; rate limiting.
- SEO metadata, OG images, sitemap/robots, JSON-LD.
- Responsive at 390 px; Playwright + axe; Lighthouse budgets.
- Acceptance: a real visitor can go from landing to a stored, emailed lead on a
  phone; Lighthouse mobile ≥ 95; no horizontal scroll; CI green.

### Phase 2 — conversion and proof (3–4 days)

- Estimator wizard using the tenant matrix; project case studies; reviews; local
  area pages (3 cities); FAQ schema; analytics events.
- Acceptance: estimator completion event fires; range matches the API; 3 area
  pages published with unique content.

### Phase 3 — self-service and operations (4–5 days)

- Admin site editor, leads inbox, content versioning, CSV export, review-request
  email after project completion.
- Acceptance: a tenant can change the hero and add a project without a deploy;
  a lead appears in the inbox and can move through statuses.

### Phase 4 — platform marketing (3–4 days)

- Apex site reusing the same components: product story, pricing, demo tenant,
  sign-up/onboarding CTA.
- Acceptance: apex does not index tenant pages and vice versa; brand is clearly
  the platform, not a contractor.

---

## 17. Risks and open decisions

| Risk | Mitigation |
|---|---|
| No real photography at launch | Demo uses licence-cleared stock labelled "sample"; phase 1 includes a shot list for tenants |
| Estimated ranges read as quotes | Explicit disclaimer, range + "what changes it", CTA to walkthrough |
| Thin local pages / duplicate content | Only real areas; unique local proof; content review |
| Lead spam | Honeypot + rate limit + timing; Turnstile if needed |
| Multi-tenant caching leaks | Cache keys include host; no personalisation; tests with two tenants |
| Estimator licence/accuracy | Tenant supplies matrix; platform disclaims; audit trail |
| Branding accent breaks contrast | Computed readable ink; CI contrast checks on tokens |

**Decisions requested before build:**

1. **Scope:** tenant marketing site first (recommended) or platform apex first?
2. **Content:** seed the demo tenant with a reviewed default template (fast) or
   wait for real contractor content (slower, more authentic)?
3. **Booking:** internal "request a walkthrough" form first, or a Cal.com embed?
4. **Photography:** licence-cleared stock labelled as sample for the demo, or
   block launch until real project photos exist?

---

## 18. Out of scope for phase 1

- Blog/CMS authoring, online payments or deposits, live chat.
- Multi-language and multi-currency.
- Per-service availability calendars (beyond the walkthrough request).
- The platform apex marketing site (phase 4).
- Automated review collection or third-party review scraping.
- Photo uploads (phase 3; URLs only until then).

---

## Appendix A — skill catalog review

Fetched from `deepseek-ai/deepseek-harness` → `.agents/skills` (21 entries).

| Skill | Relevance | Use |
|---|---|---|
| `dsh-client-ui-ux` | **High** | token reuse, feedback surfaces, loading states, overlay safety, spacing |
| `dsh-responsive-ui` | **High** | 390 px baseline, truncation/title rules, hover media, 16 px inputs, focus |
| `dsh-speed-up-perf` | **High** | measurement-first budgets, lab vs field, negative controls |
| `dsh-prose-standard` | **High** | sentence case, complete claims, plain error copy |
| `dsh-error-handling` | **Medium** | form failures keep data, actionable messages, no false success |
| `record-browser-gif` | **Medium** | optional launch/demo GIF from the real site |
| `dsh-official-plugin-artwork` | Low | icon-only guidance; not page design |
| `agent-experience` | None | DSH agent UX |
| `cordis-styling-nitpicking` | None | lifecycle audit (name is misleading) |
| `dsh-archive-agent-notes`, `dsh-ci-test-reliability`, `dsh-code-review`, `dsh-create-upgrade-guide`, `dsh-doc`, `dsh-find-simplifications`, `dsh-merging-stacked-prs`, `dsh-pr-description`, `dsh-pre-push-checks`, `dsh-session-projection`, `dsh-translate-docs`, `dsh-trim-cot-leakage` | None | DSH-internal maintenance workflows |

## Appendix B — how the design rules map

| Skill rule | Application here |
|---|---|
| Reuse existing tokens/components | Tenant colours, radius, logo and the existing Tailwind bindings; one icon set |
| Feedback by surface lifetime | Field errors inline; successful lead → dedicated thank-you page; transient copy failures → toast |
| Loading states | Skeleton only for the project gallery; no spinner for static marketing pages |
| Overlay rules | Mobile drawer dismissible, focus-trapped, viewport-fit, Escape to close |
| 390 px baseline | Acceptance viewport; test 360 and 1440 |
| Space before truncation | Services/cards wrap; only nav labels truncate |
| Hover under `(hover: hover)` | Card lifts and image zoom never stick on touch |
| 16 px inputs on coarse pointers | Prevents iOS zoom on the lead form and estimator |
| Measurement before optimization | Lighthouse baseline, then budgeted fixes with before/after |
| Sentence case + complete claims | All UI copy and marketing claims |
| Failures stay visible and actionable | Lead form keeps input on error and offers the phone number |
| Display weight exception | Body and UI stay at 400/500; marketing display headings use 550–600 for hierarchy, never 700+ |

## Appendix C — build inventory (phase 1)

New files (indicative):

```
migrations/006_public_site.sql
src/modules/public/lead.repository.ts
src/modules/public/lead.service.ts
src/modules/public/lead.schemas.ts
src/modules/public/lead.routes.ts
src/modules/public/site-content.schemas.ts
portal/app/(marketing)/layout.tsx
portal/app/(marketing)/page.tsx
portal/app/(marketing)/services/page.tsx
portal/app/(marketing)/services/[slug]/page.tsx
portal/app/(marketing)/projects/page.tsx
portal/app/(marketing)/projects/[slug]/page.tsx
portal/app/(marketing)/about/page.tsx
portal/app/(marketing)/contact/page.tsx
portal/app/(marketing)/privacy/page.tsx
portal/app/(marketing)/terms/page.tsx
portal/app/(marketing)/thank-you/page.tsx
portal/app/api/lead/route.ts
portal/components/marketing/*.tsx
portal/lib/site-content.ts
portal/lib/leads.ts
tests/e2e/marketing.spec.ts
lighthouserc.json
```

Existing files touched: `portal/app/page.tsx` (move), `portal/app/layout.tsx`
(keep global theme), `src/app.ts` (mount public routes), `.env.example`,
`README.md`, OpenAPI.
