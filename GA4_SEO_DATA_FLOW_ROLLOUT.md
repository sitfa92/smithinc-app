# GA4 SEO Data Flow Rollout (Safe, Non-Breaking)

## Goal

Create one reliable analytics backbone across:

- IONOS storefront (`ionos-store`)
- Meet Serenity app (`src/` + `api/`)
- Base44 referrals (through existing bridge + web vitals endpoint)

while preserving current behavior and avoiding breaking changes.

## What Is Already Added

1. Unified ingest endpoint:
- `POST /api/analytics/unified-event`
- Optional shared-secret auth using `ANALYTICS_INGEST_SECRET`
- Safe forwarding to GA4 Measurement Protocol

2. GA4 Measurement Protocol helper:
- `api/_lib/ga4-measurement.js`
- Uses `GA4_MEASUREMENT_ID` + `GA4_API_SECRET`

3. Meet Serenity + Base44 relay:
- `api/analytics/web-vitals.js` now forwards `web_vital` events to GA4 MP (non-blocking)
- `src/webVitals.js` now sends stable `clientId`

4. Storefront relay hardening:
- `ionos-store/api/commerce/analytics-event.js` forwards `clientId`, `userId`, and source metadata
- Optional `x-analytics-secret` header via `STORE_ANALYTICS_WEBHOOK_SECRET`
- `ionos-store/src/lib/eventTracker.js` now sends stable `clientId`

5. Meet Serenity SEO and marketing event layer:
- `src/ga4SeoTracker.js` added for non-blocking `unified-event` forwarding
- `seo_route_view` event now fires on route transitions from `RouteSeo` in `src/App.jsx`
- Top public-shell CTAs now fire `cta_click` events with destination metadata
- Public booking/partner/ambassador forms now fire conversion events:
	- `booking_request`
	- `lead_submit`

## Environment Variables

Set these in the Meet Serenity app deployment (root project):

- `GA4_MEASUREMENT_ID=G-WGFZW7XLXM`
- `GA4_API_SECRET=<from GA4 Data Stream Measurement Protocol API secret>`
- `ANALYTICS_INGEST_SECRET=<long random secret>`

Set these in `ionos-store` deployment:

- `STORE_ANALYTICS_WEBHOOK_URL=https://meet-serenity.online/api/analytics/unified-event`
- `STORE_ANALYTICS_WEBHOOK_SECRET=<same value as ANALYTICS_INGEST_SECRET>`

## Safe Activation Order

1. Add env vars only (no code toggle needed).
2. Deploy Meet Serenity app.
3. Deploy `ionos-store`.
4. Validate in GA4 Realtime:
- storefront page view + policy page navigation
- Meet Serenity app route load
- Base44-attributed session event
5. Keep old paths in place:
- storefront client-side GA4 remains active
- `/api/analytics/web-vitals` remains active

This creates additive redundancy during rollout.

## SEO-Focused GA4 Configuration (Google UI)

1. Link GA4 to Search Console (property association).
2. Mark SEO funnel events as key events:
- `page_view`
- `web_vital`
- `signup_submit` / `booking_submit` equivalents where applicable
3. Create exploration by `landing page + query string` and source/medium.
4. Build custom report for:
- Organic landing pages
- Engagement rate
- Conversions by page path
- CWV proxy from `web_vital` events

5. Add an exploration for `seo_route_view`:
- Breakdown by `route_label`, `robots`, and `is_indexable`
- Compare query-param traffic (`has_query_params=true`) vs clean URL traffic
- Use this to identify SEO pages with high entrance volume but weak conversion events

## Marketing GA4 Configuration (Meet Serenity Online)

1. Build funnel exploration:
- `seo_route_view` -> `cta_click` -> `lead_submit` / `booking_request`

2. Build campaign report dimensions:
- `session source / medium`
- landing page + query string
- route label

3. Mark key events:
- `lead_submit`
- `booking_request`
- `cta_click` (secondary optimization signal)

4. Audience seeds:
- Viewed SEO page but no conversion in 7 days
- Clicked CTA but no conversion in 3 days
- Converted leads by referral source

## Monetization With Google Ads + GA4

1. In GA4 Admin -> Product Links:
- Link Google Ads account and enable personalized advertising + auto-tagging

2. Import conversions from GA4 into Google Ads:
- `lead_submit`
- `booking_request`

3. Launch initial campaigns with value rules:
- Branded search (protect intent)
- High-intent program terms (model development, booking consultation)
- Retargeting audience from non-converted CTA clicks

4. Optimization cadence:
- Week 1-2: validate conversion consistency and attribution
- Week 3-4: adjust creatives and landing paths by GA4 route-level conversion rate
- Weekly: move budget toward campaigns with strongest conversion and lower cost per lead

## Guardrails

- All new forwarding is non-blocking (no user-facing hard failure).
- Shared-secret auth can be enforced without changing clients by setting env vars.
- No schema migration required for this phase.
- Existing analytics paths are untouched and continue to function.
