# WhatsApp Cloud API — Webhook Setup Guide

> **Purpose:** Configure the Meta side of the WhatsApp integration so the
> Communications workspace can capture inbound messages and send replies.
> **Audience:** Platform administrators / DevOps doing first-time setup.
> **Prerequisites:** A Meta (Facebook) account, the platform deployed to a
> public HTTPS URL (e.g. the production Vercel URL), and the ability to set
> server environment variables.

This guide takes you from nothing to a verified, working webhook. It pairs with
the variable table in [`ENVIRONMENT_REFERENCE.md`](ENVIRONMENT_REFERENCE.md#whatsapp-cloud-api-required-for-the-communications-whatsapp-inbox).

---

## How it fits together

```
WhatsApp user ──▶ Meta Cloud API ──▶ POST /api/comms/whatsapp ──▶ intake_items
                                       (signature-verified)         (auto-classified)

Comms operator ──▶ "Reply" in inbox ──▶ Graph API send ──▶ WhatsApp user
                                                  │
WhatsApp user reads it ──▶ Meta "statuses" ──▶ POST /api/comms/whatsapp
                                                  └──▶ delivery_status: delivered/read
```

- **Inbound messages** arrive as `messages` webhook events and become intake items.
- **Delivery receipts** arrive as `statuses` webhook events and update the
  `delivery_status` of the reply you sent (sent → delivered → read, or failed).
  Both ride the **same** callback URL, so subscribe to both fields (step 5).

---

## Step 1 — Create / open a Meta App

1. Go to <https://developers.facebook.com/apps> and create an app (type
   **Business**) or open your existing one.
2. In the app dashboard, **Add Product → WhatsApp → Set up**.
3. This creates a WhatsApp Business Account (WABA) and a **test phone number**
   you can use before adding a real number.

## Step 2 — Collect the outbound credentials

From **WhatsApp → API Setup**:

| Value | Maps to env var |
|-------|-----------------|
| Temporary access token (or a System User token, see step 7) | `WHATSAPP_ACCESS_TOKEN` |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` |

From **App Settings → Basic**:

| Value | Maps to env var |
|-------|-----------------|
| App Secret (click **Show**) | `WHATSAPP_APP_SECRET` |

## Step 3 — Choose a verify token

Pick any hard-to-guess string (e.g. `openssl rand -hex 16`). This is **not**
issued by Meta — you invent it, set it as `WHATSAPP_VERIFY_TOKEN` on the server,
and type the identical value into the Meta webhook config in step 4. Meta echoes
it back during verification so each side proves it agrees on the token.

## Step 4 — Set the environment variables and deploy

Set these on the server (Vercel → Project → Settings → Environment Variables,
**Production** scope) and redeploy so they're live **before** you verify:

```
WHATSAPP_VERIFY_TOKEN=<the string from step 3>
WHATSAPP_APP_SECRET=<from step 2>
WHATSAPP_ACCESS_TOKEN=<from step 2>
WHATSAPP_PHONE_NUMBER_ID=<from step 2>
WHATSAPP_BUSINESS_ACCOUNT_ID=<from step 2>
```

> The webhook must be reachable and have `WHATSAPP_VERIFY_TOKEN` set before the
> next step — Meta calls it immediately when you click **Verify and save**.

## Step 5 — Configure the webhook callback

1. In the app dashboard go to **WhatsApp → Configuration → Webhook**.
2. Click **Edit** and enter:
   - **Callback URL:** `https://<your-app-domain>/api/comms/whatsapp`
   - **Verify token:** the exact value of `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and save**. Meta sends a `GET` with `hub.challenge`; the
   endpoint echoes it back when the tokens match. A green check means success.
4. Under **Webhook fields**, click **Manage** and **Subscribe** to:
   - **`messages`** — inbound messages (required).
   - **`message_status`** *(a.k.a. statuses)* — delivery/read receipts so the
     inbox can show delivered/read state on your replies.

## Step 6 — Verify end to end

1. **Inbound:** From a phone allowed by your test number, send a WhatsApp
   message to the business number. Within seconds it should appear in
   **Comms → WhatsApp** (and the intake queue). If not, check **Comms →
   WhatsApp → Webhook health** for failed events, and the server logs.
2. **Outbound:** Reply from the inbox. The recipient should receive it, and the
   message's status should progress to **Delivered** / **Read** as receipts
   arrive.
3. **Signature:** A `401` on the `POST` means `WHATSAPP_APP_SECRET` is wrong or
   missing — the request's `x-hub-signature-256` failed verification.

## Step 7 — Production hardening (before go-live)

- **Long-lived token:** The temporary token from step 2 expires in ~24h. Create
  a **System User** (Business Settings → System Users), assign it the WABA with
  `whatsapp_business_messaging` permission, and generate a non-expiring token.
  Update `WHATSAPP_ACCESS_TOKEN`.
- **Real phone number:** Add and verify your production number under WhatsApp →
  API Setup, then update `WHATSAPP_PHONE_NUMBER_ID`.
- **App review / Live mode:** Switch the app to **Live** and complete any
  required business verification so non-test recipients can message you.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| **Verify and save** fails (red) | `WHATSAPP_VERIFY_TOKEN` not deployed, mismatched, or the callback URL is wrong/not yet live. |
| Inbound messages never arrive | Not subscribed to the `messages` field, or signature failing (see below). |
| `POST` returns 401 | `WHATSAPP_APP_SECRET` missing/incorrect — `x-hub-signature-256` didn't match. |
| `POST` returns 500 "auth is not configured" | Neither `WHATSAPP_APP_SECRET` nor `WHATSAPP_WEBHOOK_SECRET` is set. |
| Replies fail with "send is not configured" | `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` missing. |
| Replies send but never show Delivered/Read | Not subscribed to the `message_status` field. |
| Failed events accumulating | Inspect and replay them in **Comms → WhatsApp → Webhook health**. |

---

*Maintainer: Michael Wittinger · See also: `ENVIRONMENT_REFERENCE.md`, `MONITORING.md`*
