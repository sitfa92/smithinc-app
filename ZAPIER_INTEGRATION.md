# Zapier ↔ CRM ↔ Serenity Field Mapping

This document defines the standard field mapping between your CRM (via Zapier) and the Serenity App.

## Webhook Configuration

**URL:** `https://smithinc-vzo9d7nva-sitfa92s-projects.vercel.app/api/zapier/webhook`

**Method:** POST

**Authentication:**
```
Header: x-zapier-secret
Value: [ZAPIER_WEBHOOK_SECRET from environment]
```

**Body Format (JSON):**
```json
{
  "type": "EVENT_TYPE",
  "data": {
    // event-specific fields
  }
}
```

---

## Event Types & Field Mappings

### 1. NEW_LEAD
Triggered when a new inquiry or form submission arrives from your CRM.

**Event Type:** `NEW_LEAD`

**Zapier → CRM Field Mapping:**

| Serenity Field | CRM Field | Required | Type | Notes |
|---|---|---|---|---|
| `name` | Contact First Name + Last Name | Yes | string | Combine into single field |
| `email` | Contact Email | Yes | string | Must be unique |
| `phone` | Contact Phone | No | string | Include if available |
| `service_type` | Inquiry Type / Service Name | No | string | E.g., "Model Consultation", "Booking Inquiry" |
| `message` | Form Message / Description | No | string | Inquiry details |
| `external_record_id` | CRM Contact/Record ID | No | string | Optional external reference ID |

**Example Zapier POST:**
```json
{
  "type": "NEW_LEAD",
  "data": {
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "+1-555-0123",
    "service_type": "Model Development Program",
    "message": "Interested in the 6-month program",
    "external_record_id": "crm_12345"
  }
}
```

---

### 2. CLIENT_CONVERTED
Triggered when a lead becomes a paying client (contract signed OR invoice paid).

**Event Type:** `CLIENT_CONVERTED`

**Zapier → CRM Field Mapping:**

| Serenity Field | CRM Field | Required | Type | Notes |
|---|---|---|---|---|
| `email` | Contact Email | Yes | string | Links to existing lead |
| `external_record_id` | CRM Contact/Record ID | No | string | Optional external reference ID |
| `contract_signed` | Contract Status / Date | No | boolean | True if contract is signed |
| `invoice_paid` | Invoice Status / Payment Status | No | boolean | True if invoice is paid |
| `service_type` | Service / Product Name | No | string | What they're buying |
| `client_value` | Invoice Amount / Total Value | No | number | Payment amount in dollars |

**Example Zapier POST:**
```json
{
  "type": "CLIENT_CONVERTED",
  "data": {
    "email": "sarah@example.com",
    "external_record_id": "crm_12345",
    "contract_signed": true,
    "invoice_paid": true,
    "service_type": "Model Development Program - 6 Month",
    "client_value": 1500
  }
}
```

---

### 3. PROGRAM_ENROLLMENT
Triggered when a client enrolls in a model development program (after conversion).

**Event Type:** `PROGRAM_ENROLLMENT`

**Zapier → CRM Field Mapping:**

| Serenity Field | CRM Field | Required | Type | Notes |
|---|---|---|---|---|
| `email` | Contact Email | Yes | string | Links to client record |
| `program_name` | Program Name | Yes | string | E.g., "6-Month Development Track" |
| `program_tier` | Program Level / Tier | No | string | starter, standard, or premium |
| `start_date` | Program Start Date | No | date/ISO | Format: YYYY-MM-DD or ISO 8601 |
| `external_record_id` | CRM Contact/Record ID | No | string | Optional external reference ID |

**Example Zapier POST:**
```json
{
  "type": "PROGRAM_ENROLLMENT",
  "data": {
    "email": "sarah@example.com",
    "program_name": "6-Month Model Development Track",
    "program_tier": "standard",
    "start_date": "2026-04-20",
    "external_record_id": "crm_12345"
  }
}
```

---

## CRM Trigger Configuration in Zapier

### Step 1: Create Zapier Zap
- **Trigger:** Your CRM app (choose the event type)
  - "New Contact" → NEW_LEAD
  - "Update Contact" (when status = paid) → CLIENT_CONVERTED
  - "New Project" or "Status Change" → PROGRAM_ENROLLMENT

### Step 2: Extract CRM Fields
Map these CRM fields to Zapier variables:
- Contact First Name → name (part 1)
- Contact Last Name → name (part 2)
- Contact Email → email
- Contact Phone → phone
- Inquiry Type → service_type
- Form Message / Description → message
- CRM Contact/Record ID → external_record_id

### Step 3: Format Request Body
Use Zapier's **JSON** or **Code by Zapier** module to construct the exact JSON structure above.

### Step 4: Send to Webhook
- **URL:** (from Configuration section above)
- **Method:** POST
- **Headers:**
  - `x-zapier-secret: [your-secret]`
  - `Content-Type: application/json`
- **Body:** (the formatted JSON from Step 3)

---

## Testing the Integration

### Test with curl:
```bash
curl -X POST https://smithinc-vzo9d7nva-sitfa92s-projects.vercel.app/api/zapier/webhook \
  -H "Content-Type: application/json" \
  -H "x-zapier-secret: YOUR_SECRET" \
  -d '{
    "type": "NEW_LEAD",
    "data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "555-0123",
      "service_type": "Test",
      "message": "Testing integration",
      "external_record_id": "test_123"
    }
  }'
```

### Expected Response:
```json
{
  "success": true,
  "message": "Lead captured",
  "leadId": "uuid-here"
}
```

---

## Viewing Workflow Events

All Zapier events are logged to the `workflow_events` table in Supabase and visible in the Serenity App dashboard.

- **Table:** `public.workflow_events`
- **Fields:** `event_type`, `event_data`, `status`, `error_message`, `created_at`
- **Error Tracking:** Failed events are logged with error details for debugging

---

## Error Handling

| Error | Cause | Solution |
|---|---|---|
| `Invalid or missing webhook secret` | Zapier secret doesn't match | Update ZAPIER_WEBHOOK_SECRET env var on Vercel |
| `Missing required fields: name, email` | NEW_LEAD missing name or email | Ensure your CRM form captures these fields |
| `Lead not found for email` | CLIENT_CONVERTED references non-existent lead | Verify email matches NEW_LEAD record |
| `Client not found for email` | PROGRAM_ENROLLMENT references non-existent client | Ensure CLIENT_CONVERTED was processed first |

All errors are logged to `workflow_events` with status `"failed"` and error details in `error_message`.
