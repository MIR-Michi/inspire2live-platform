# WhatsApp Bi-directional Activation — I2L Runbook

> **Purpose:** Activate the WhatsApp integration end-to-end for the I2L
> Communications workspace. Inbound messages land in the intake queue;
> replies sent from the inbox reach recipients via the Graph API.
>
> **Audience:** Platform admin doing the first-time production activation.
>
> **Pre-filled account details (from your Meta Business portfolio):**
> - Meta App: **I2L_Business_test** — App ID `1479113874015743`
> - WhatsApp Business Account (WABA): **I2L** — WABA ID `3365644843603252`
> - Phone number: **+43 670 6072307** (currently *Pending* — see step 0)

---

## How the integration works

```
WhatsApp user ──▶ Meta Cloud API ──▶ POST /api/comms/whatsapp ──▶ intake_items
                                      (HMAC-verified)              (auto-classified)

Comms operator ──▶ Reply in inbox ──▶ Graph API send ──▶ WhatsApp user
                                             │
WhatsApp user reads ──▶ "statuses" event ──▶ POST /api/comms/whatsapp
                                             └──▶ delivery_status: delivered / read
```

Both inbound messages **and** delivery receipts arrive on the same callback URL
(`/api/comms/whatsapp`), so you subscribe to both webhook fields in step 3.
The code is complete — this is a pure configuration exercise.

---

## Step 0 — Register the phone number (if still Pending)

Your number `+43 670 6072307` shows **Pending** status in Business Settings.
A pending number cannot send messages.

1. Go to **developers.facebook.com/apps** → **I2L_Business_test** → left
   sidebar **WhatsApp → API Setup**.
2. Under "Step 5 — Add a phone number" (or "Manage phone numbers"), find
   `+43 670 6072307` and click **Register**.
3. Meta will prompt you to set a **two-step verification PIN** (6 digits —
   store it somewhere safe; losing it requires a 7-day recovery).
4. Wait for status to flip to **Connected** before continuing.

> If the number still shows Pending after registration, the WABA may need
> **business verification** first. Check **Required actions** at the top of
> the Meta app dashboard.

---

## Step 1 — Collect the four values from Meta

All four items live in the Meta app dashboard under **I2L_Business_test**.

### 1a. Phone Number ID

> ⚠️ This is **not** the phone number `+43 670 6072307`. It is a separate
> numeric node ID (~15 digits).

**Where:** App dashboard → **WhatsApp → API Setup** → "Phone number ID" field
(displayed next to your number in the "Send and receive messages" panel).

Copy and save it as:
```
WHATSAPP_PHONE_NUMBER_ID=<the 15-digit number from that field>
```

### 1b. Temporary access token

**Where:** Same **WhatsApp → API Setup** page → "Temporary access token"
(click **Generate token**).

Valid for **24 hours** — fine for first-time testing. Replace with a
long-lived System User token for production (step 6).

```
WHATSAPP_ACCESS_TOKEN=<paste the token>
```

### 1c. App Secret

**Where:** App dashboard → **App Settings → Basic** → "App Secret" → click
**Show**.

```
WHATSAPP_APP_SECRET=<the secret>
```

### 1d. Verify token (you invent this)

Meta does not issue this — you create it. Run the command below and keep the
output:

```bash
openssl rand -hex 16
```

You will paste this **same value** into Meta in step 3 *and* into Vercel in
step 2. It proves both sides agree before messages flow.

```
WHATSAPP_VERIFY_TOKEN=<your random string>
```

---

## Step 2 — Set environment variables on Vercel

1. Open your Vercel project → **Settings → Environment Variables**.
2. Add all five variables with scope **Production** (and Preview if you want
   to test on preview deploys):

| Variable | Value |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | Your random string from step 1d |
| `WHATSAPP_APP_SECRET` | From step 1c |
| `WHATSAPP_ACCESS_TOKEN` | From step 1b |
| `WHATSAPP_PHONE_NUMBER_ID` | From step 1a |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `3365644843603252` |

3. **Redeploy** the production deployment (Vercel → Deployments → Redeploy,
   or push any commit). The webhook endpoint **must** be live and have
   `WHATSAPP_VERIFY_TOKEN` set before step 3, because Meta calls it
   immediately on "Verify and save".

> **Security:** Never paste `WHATSAPP_APP_SECRET` or `WHATSAPP_ACCESS_TOKEN`
> anywhere but Vercel env vars. They must not appear in source control or
> chat logs.

---

## Step 3 — Register the webhook callback in Meta

1. App dashboard → **WhatsApp → Configuration** → find the **Webhook** section
   → click **Edit**.
2. Enter:
   - **Callback URL:** `https://inspire2live-platform.vercel.app/api/comms/whatsapp`
   - **Verify token:** the exact value of `WHATSAPP_VERIFY_TOKEN` from step 1d
3. Click **Verify and save**.
   - Meta sends a `GET` with `hub.challenge`; your endpoint echoes it back.
   - A **green check** = success. A **red error** = the token doesn't match or
     the deployment hasn't picked up the env var yet (wait 30 seconds and retry).

---

## Step 4 — Subscribe to webhook fields

On the same Configuration page, click **Manage** next to Webhook fields and
**Subscribe** to both:

| Field | Why |
|---|---|
| `messages` | Inbound messages → intake queue (required) |
| `message_status` | Delivery and read receipts on your replies |

---

## Step 5 — Smoke test

**Inbound:**
1. Send a WhatsApp message from a test phone to `+43 670 6072307`.
2. Within seconds it should appear in **Comms → WhatsApp** and **Comms →
   Intake**.
3. If it doesn't, open **Comms → WhatsApp → Webhook health** to see failed
   events and error details.

**Outbound:**
1. In the inbox, open the conversation and click **Reply**.
2. The recipient's phone should receive the message.
3. The message status in the inbox should progress: *Sent → Delivered → Read*.

---

## Step 6 — Production hardening (before public go-live)

### Replace the 24h token with a permanent System User token

1. **Business Settings** (business.facebook.com) → **Users → System Users** →
   **Add** a new system user (role: Admin or Employee).
2. Click the user → **Add Assets** → assign your WABA `3365644843603252` with
   **Full control** (or at minimum `whatsapp_business_messaging` permission).
3. Click **Generate New Token** → select app **I2L_Business_test** → tick
   `whatsapp_business_management` and `whatsapp_business_messaging` → copy token.
4. Update `WHATSAPP_ACCESS_TOKEN` in Vercel with this non-expiring token and
   redeploy.

### Switch app to Live mode (to receive from arbitrary numbers)

While the app is **In development**, only testers added under
**App Roles → Testers** can message you. To open to all WhatsApp users:

1. App dashboard → **App Settings → Basic** → fill in Privacy Policy URL and
   Terms of Service URL.
2. Click **Save changes**.
3. Toggle the **In development** switch → **Live**.
4. Complete any **Required actions** shown in the app dashboard (often:
   business verification for the Meta Business portfolio, or use-case
   declaration).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Verify and save" fails (red) | Token mismatch or deployment not live yet | Re-check `WHATSAPP_VERIFY_TOKEN` in Vercel; redeploy; retry |
| Inbound messages never arrive | Not subscribed to `messages` field | Check step 4 |
| `POST` returns `401` | `WHATSAPP_APP_SECRET` missing or wrong | Re-check value in Vercel and redeploy |
| `POST` returns `500 "auth is not configured"` | Neither `WHATSAPP_APP_SECRET` nor `WHATSAPP_WEBHOOK_SECRET` is set | Add `WHATSAPP_APP_SECRET` to Vercel |
| Replies fail with "send is not configured" | `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` missing | Add both to Vercel |
| Replies send but never show Delivered/Read | Not subscribed to `message_status` field | Check step 4 |
| Number stuck on Pending | Business verification incomplete | Check Required actions in Meta app dashboard |
| Failed events accumulating | Various | Inspect and replay at Comms → WhatsApp → Webhook health |

---

## Reference

| Item | Value |
|---|---|
| Meta App | I2L_Business_test |
| App ID | `1479113874015743` |
| WABA | I2L |
| WABA ID | `3365644843603252` |
| Phone number | `+43 670 6072307` (AT Austria) |
| Webhook endpoint | `https://inspire2live-platform.vercel.app/api/comms/whatsapp` |
| Graph API version | v21.0 |

Related docs: [`WHATSAPP_WEBHOOK_SETUP.md`](WHATSAPP_WEBHOOK_SETUP.md) ·
[`ENVIRONMENT_REFERENCE.md`](ENVIRONMENT_REFERENCE.md)

---

*Maintainer: Michael Wittinger · Last updated: 2026-06-23*
