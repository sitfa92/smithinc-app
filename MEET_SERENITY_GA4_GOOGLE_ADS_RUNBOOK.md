# Meet Serenity: GA4 to Google Ads Runbook

## Objective

Turn Meet Serenity traffic into measurable, optimizable paid growth by:

1. Tracking high-intent events in GA4
2. Importing those events into Google Ads as conversions
3. Building audiences from non-converting sessions
4. Optimizing budget allocation using route-level conversion performance

## Event Contract (Already Implemented)

Primary conversion candidates:

- `booking_request`
- `lead_submit`

Secondary optimization signal:

- `cta_click`

SEO and landing performance signal:

- `seo_route_view`

Attribution parameters automatically forwarded when available:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `gclid`
- `wbraid`
- `gbraid`

Value metadata currently attached:

- `booking_request`: `conversion_value=150`, `currency=USD`
- `lead_submit` (partner): `conversion_value=90`, `currency=USD`
- `lead_submit` (ambassador): `conversion_value=75`, `currency=USD`

Direct Google Ads conversion firing is now implemented client-side for:

- `booking_request`
- `lead_submit` (partner)
- `lead_submit` (brand ambassador)

### Required Vercel Environment Variables (Meet Serenity App)

- `VITE_GOOGLE_ADS_ID` (example: `AW-123456789`)
- `VITE_GOOGLE_ADS_BOOKING_LABEL`
- `VITE_GOOGLE_ADS_PARTNER_LEAD_LABEL`
- `VITE_GOOGLE_ADS_AMBASSADOR_LEAD_LABEL`

When any label is missing, that specific Google Ads conversion is skipped safely.

## GA4 Setup Checklist

1. Admin -> Product Links -> Google Ads Links
- Link the Google Ads account for Meet Serenity
- Enable Personalized Advertising

2. Admin -> Events
- Confirm these events are arriving in Realtime/DebugView:
  - `seo_route_view`
  - `cta_click`
  - `booking_request`
  - `lead_submit`

3. Admin -> Key events
- Mark as key events:
  - `booking_request` (Primary)
  - `lead_submit` (Primary)
- Keep `cta_click` as non-key (secondary signal)

4. Reports -> Explore
- Build funnel exploration:
  - Step 1: `seo_route_view`
  - Step 2: `cta_click`
  - Step 3: `booking_request` OR `lead_submit`
- Breakdown by:
  - `page path + query string`
  - `session source / medium`
  - `utm_campaign`

## Google Ads Conversion Import Checklist

1. In Google Ads: Tools -> Conversions -> New conversion action -> Import -> GA4 properties
2. Import:
- `booking_request`
- `lead_submit`

3. Conversion settings:
- Goal category: Lead
- Action optimization: Primary action for bidding
- Count: One
- Attribution model: Data-driven (recommended)

4. Value settings:
- Use GA4 event value if available (recommended)
- If unavailable, use fixed fallback values by action type

## Audience Strategy (GA4 -> Ads)

Create these audiences in GA4 and share to Google Ads:

1. SEO engaged, no conversion (7 days)
- Include: `seo_route_view`
- Exclude: `booking_request`, `lead_submit`

2. CTA clickers, no conversion (3 days)
- Include: `cta_click`
- Exclude: `booking_request`, `lead_submit`

3. High-intent landing visitors
- Include users where page path contains:
  - `/model-development`
  - `/book`
  - `/model-signup`

## Campaign Launch Structure

1. Brand Search
- Protect branded intent and reduce competitor interception
- Bid on Meet Serenity and close variants

2. High-intent Non-Brand Search
- Focus on model development and booking consultation intent
- Route to strongest converting pages by GA4 funnel data

3. Remarketing
- Target audience: CTA clickers and SEO engaged non-converters
- Creative focus: proof, clarity, urgency, and next step

## Optimization Cadence

Week 1:
- Validate event consistency and conversion import status
- Verify no major mismatch between GA4 and Ads conversion counts

Week 2:
- Compare conversion rate by landing path
- Pause weak paths and shift traffic to top performers

Week 3-4:
- Optimize ad groups and keywords by cost per conversion
- Scale campaigns with best blended performance

Weekly ongoing:
- Reallocate spend toward highest conversion-rate + lowest cost-per-lead combinations
- Refresh creatives for ad fatigue and low CTR clusters

## QA Commands (Already Used)

Smoke test events against production endpoint:

```bash
for evt in seo_route_view cta_click booking_request lead_submit; do
  curl -sS -X POST 'https://meet-serenity.online/api/analytics/unified-event' \
    -H 'Content-Type: application/json' \
    -H 'Origin: https://meet-serenity.online' \
    --data '{"eventName":"'"$evt"'","source":"manual_smoke_test","app":"meet_serenity_web","platform":"web","path":"/smoke-test","href":"https://meet-serenity.online/smoke-test","referrer":"https://google.com","clientId":"smoke.test.client"}'
done
```

Expected response shape:

- `ok: true`
- `ga4Forwarded: true`
- `ga4Skipped: false`

## Notes

- If you want stricter security while keeping browser ingestion, set `ANALYTICS_TRUSTED_ORIGINS` explicitly in production.
- Revisit conversion values monthly and align with actual lead quality and close rate.
