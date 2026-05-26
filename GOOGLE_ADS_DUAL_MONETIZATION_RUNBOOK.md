# Google Ads Monetization Runbook (Meet Serenity + IONOS Storefront)

## Scope

This runbook covers Ads monetization setup for both properties:

1. Meet Serenity (`meet-serenity.online`)
2. IONOS Storefront (`shop.sitfa92.online`)

## Property and Conversion Map

### Meet Serenity GA4

Recommended primary conversions:

- `booking_request`
- `lead_submit`

Recommended secondary optimization signal:

- `cta_click`

Support dimensions already passed in events:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `gclid`, `wbraid`, `gbraid`
- `conversion_value`, `currency`

### IONOS Storefront GA4

Recommended primary conversion:

- `purchase`

Secondary conversion signals:

- `begin_checkout`
- `generate_lead`

Reference plan: `ionos-store/GOOGLE_ADS_MONETIZATION_PLAN.md`

## Phase 1: Link and Import

Do these for each GA4 property:

1. GA4 Admin -> Product links -> Google Ads links
2. Enable personalized advertising + auto tagging
3. Google Ads -> Conversions -> Import from GA4
4. Import conversions:
- Meet Serenity: `booking_request`, `lead_submit`
- Storefront: `purchase` (primary), optionally `begin_checkout` as secondary

## Phase 2: Campaign Structure

### Meet Serenity campaigns

1. Branded Search
- Protect brand intent
- Landing pages: `/`, `/book`, `/model-development`

2. High-intent Non-brand Search
- Themes: model development, consultation booking, fashion coaching
- Primary optimization: `booking_request`

3. Remarketing
- Audience: users with `cta_click` but no `lead_submit`/`booking_request`
- Window: 3-14 days

### IONOS Storefront campaigns

1. Prospecting (PMAX or Search + Demand Gen)
- Primary optimization: `purchase`

2. Checkout recovery
- Audience: begin checkout/no purchase

3. Content-to-commerce retargeting
- Audience: engaged readers and private-list leads

## Phase 3: Audience Definitions

### Meet Serenity audiences

1. SEO engaged non-converters (7d)
- Include: `seo_route_view`
- Exclude: `booking_request`, `lead_submit`

2. CTA clickers non-converters (3d)
- Include: `cta_click`
- Exclude: `booking_request`, `lead_submit`

3. Qualified lead converters (30d)
- Include: `lead_submit` or `booking_request`

### Storefront audiences

1. Cart abandoners 7d
2. Checkout abandoners 7d
3. Product viewers non-buyers 14d

## Bidding and Budget Guardrails

1. Start with Maximize Conversions
2. Move to target CPA/ROAS after stable conversion volume
3. Increase budget only 15-20% after 7 stable days
4. Pause groups with CPA > 1.5x target after meaningful volume

## Weekly Operating Cadence

1. Monday: funnel + CPA/ROAS review by campaign
2. Thursday: creative refresh (1 underperformer replaced)
3. Friday: budget reallocation toward highest conversion efficiency

## QA Checklist Before Spend Scaling

1. GA4 Realtime shows conversion events for both properties
2. Ads conversion import shows recent activity
3. Landing path and UTM dimensions populate correctly
4. No major discrepancy between GA4 and Ads conversion counts (outside normal attribution lag)
