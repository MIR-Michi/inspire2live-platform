# Environment Variable Reference — Inspire2Live Platform

> **Purpose:** Every environment variable explained — what it does, what breaks without it, where to get it.  
> **Audience:** Developers, DevOps, anyone configuring a new environment.  
> **Last reviewed:** 2026-06-25

---

## Quick Setup

1. Copy `.env.example` to `.env.local`
2. Fill in values following the table below
3. Never commit `.env.local` to source control

---

## Variable Reference

### Supabase (Required)

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ | — | Supabase project URL. Get from: Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ | — | Supabase anonymous/public key. Safe to expose — scoped by RLS. Get from: same page as URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ✅ | — | Bypasses RLS — **never expose to browser**. Used for admin server actions. Get from: same page, under "service_role" |

**If missing:** App cannot connect to database. All pages will fail with connection errors.

### Email (Required for notifications)

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `RESEND_API_KEY` | Server only | ✅ | — | API key for transactional email via Resend. Get from: https://resend.com/api-keys |

**If missing:** Invitation emails and notification emails will silently fail. Auth magic links still work (sent by Supabase directly).

### Application

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | Client + Server | ✅ | — | The canonical URL of the application. **Must be the production Vercel URL for production** (e.g., `https://inspire2live-platform.vercel.app`). For local dev: `http://localhost:3000`. Used for auth redirects, email links, and callback URLs. |
| `NEXT_PUBLIC_APP_NAME` | Client | ❌ | `Inspire2Live Platform` | Display name shown in UI headers and emails |

**If `NEXT_PUBLIC_APP_URL` is wrong:** Auth magic links redirect to wrong domain. Password reset links break. This was the root cause of the localhost redirect bug (see ADR or incident log).

### Scheduled Jobs

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `CRON_SECRET` | Server only | ❌ | — | Secret token to authenticate cron endpoint calls. Generate with: `openssl rand -base64 32` |

**If missing:** Cron endpoints will reject requests (401). No impact on interactive features.

### AI / Claude (Sprint 14)

AI configuration is primarily managed from `/app/admin/ai` and stored in `public.ai_settings`. Environment variables remain necessary for bootstrap, fallback, and encrypted storage.

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Server only | ❌ | — | Fallback Claude credential when no encrypted admin-managed credential exists in `ai_settings`. |
| `AI_SETTINGS_ENCRYPTION_KEY` | Server only | ✅ when storing an admin-managed credential | — | Encryption material used by the server-side AI settings helper. Use a high-entropy value and keep stable across deployments. |
| `NEXT_PUBLIC_FEATURE_AI` | Client + Server | ❌ | `false` | Feature flag for AI UI and server calls. Server code also checks `requireAiEnabled()`. |

**If `ANTHROPIC_API_KEY` is missing:** AI calls still work if an encrypted credential is stored in Admin AI Settings. If neither is configured, AI calls fail with a configuration error.

**If `AI_SETTINGS_ENCRYPTION_KEY` is missing:** Admins cannot store or decrypt the admin-managed credential. The environment fallback can still work.

**If `NEXT_PUBLIC_FEATURE_AI` is false:** Product-facing AI capabilities remain hidden and server guarded. The admin connection test can still run for setup.

### WhatsApp Cloud API (Required for the Communications WhatsApp inbox)

Powers the inbound webhook (`GET`/`POST /api/comms/whatsapp`) that captures
messages into the intake queue, and the outbound reply sender. See
[`WHATSAPP_WEBHOOK_SETUP.md`](WHATSAPP_WEBHOOK_SETUP.md) for the full Meta-side
walkthrough.

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Server only | ✅ (inbound) | — | A string you choose. Enter the **same** value in the Meta webhook config; Meta echoes it back during the `GET` verification handshake. |
| `WHATSAPP_APP_SECRET` | Server only | ✅ (inbound) | — | Meta App secret (App Settings → Basic). Used to verify the `x-hub-signature-256` HMAC on every inbound `POST`. Preferred auth method. |
| `WHATSAPP_WEBHOOK_SECRET` | Server only | ⚠️ Fallback | — | Shared secret checked against the `x-inspire2live-webhook-secret` header. Only used when `WHATSAPP_APP_SECRET` is unset (e.g. a relay/proxy that can't sign with the App secret). |
| `WHATSAPP_ACCESS_TOKEN` | Server only | ✅ (outbound) | — | Graph API token (temporary 24h or System User (long-lived) token). **Never exposed to the browser.** Required to send replies. |
| `WHATSAPP_PHONE_NUMBER_ID` | Server only | ✅ (outbound) | — | The sending phone number's ID, from WhatsApp → API Setup. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Server only | ❌ | — | The WABA ID, from API Setup. Informational/reference today. |

**If inbound vars missing:** `POST /api/comms/whatsapp` returns 500
("auth is not configured") or 401 (signature/secret mismatch); no messages are
captured. The `GET` verification handshake fails (403) without `WHATSAPP_VERIFY_TOKEN`.

**If outbound vars missing:** Sending a reply fails with "WhatsApp send is not
configured"; inbound capture is unaffected.

### Feature Flags

| Variable | Scope | Required | Default | Description |
|----------|-------|----------|---------|-------------|
| `NEXT_PUBLIC_FEATURE_CONGRESS` | Client | ❌ | `false` | Show/hide Congress features in UI |
| `NEXT_PUBLIC_FEATURE_HUBS` | Client | ❌ | `false` | Show/hide Hub Network features |
| `NEXT_PUBLIC_FEATURE_PARTNERS` | Client | ❌ | `false` | Show/hide Partner Portal features |
| `NEXT_PUBLIC_FEATURE_AI` | Client + Server | ❌ | `false` | Show/hide AI features and guard server-side AI calls |

**If missing:** Features default to hidden. Safe.

---

## Environment-Specific Configuration

### Local Development (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://bvccuypipogprmjxctxp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Inspire2Live Platform (Dev)
NEXT_PUBLIC_FEATURE_AI=false
```

### Vercel Production

All variables set in: **Vercel → Project → Settings → Environment Variables**

| Variable | Scope in Vercel | Environment |
|----------|----------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview + Production | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview + Production | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Production |
| `RESEND_API_KEY` | Production only | Production |
| `NEXT_PUBLIC_APP_URL` | Production only | Production: `https://inspire2live-platform.vercel.app` |
| `CRON_SECRET` | Production only | Production |
| `ANTHROPIC_API_KEY` | Production only | Production fallback |
| `AI_SETTINGS_ENCRYPTION_KEY` | Production only | Production |
| `WHATSAPP_VERIFY_TOKEN` | Production only | Production |
| `WHATSAPP_APP_SECRET` | Production only | Production |
| `WHATSAPP_ACCESS_TOKEN` | Production only | Production |
| `WHATSAPP_PHONE_NUMBER_ID` | Production only | Production |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Production only | Production |
| Feature flags | Preview + Production | Toggle per environment |

---

## External Configuration (Not Env Vars)

These settings live outside the codebase but affect behavior:

| Setting | Location | Must Match |
|---------|----------|------------|
| **Supabase Site URL** | Supabase Dashboard → Auth → URL Configuration | Must equal `NEXT_PUBLIC_APP_URL` |
| **Supabase Redirect URLs** | Same page | Must include `{NEXT_PUBLIC_APP_URL}/auth/callback` |
| **Resend Domain** | Resend Dashboard → Domains | Must match email sender domain |
| **Vercel Domain** | Vercel → Domains | Must match `NEXT_PUBLIC_APP_URL` |
| **AI Settings** | Platform Admin → AI Settings | Stores encrypted provider credential, default model, and default reasoning effort |

---

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| "Failed to fetch" on every page | `NEXT_PUBLIC_SUPABASE_URL` or `ANON_KEY` missing/wrong |
| Auth redirects to `localhost` in production | `NEXT_PUBLIC_APP_URL` set to `localhost` OR Supabase Site URL not updated |
| Magic links expire immediately | Supabase Site URL ≠ actual app URL |
| Emails not sending | `RESEND_API_KEY` missing or invalid |
| AI settings save fails | `AI_SETTINGS_ENCRYPTION_KEY` missing or not stable across deployments |
| AI calls fail with configuration error | No encrypted admin-managed credential and no `ANTHROPIC_API_KEY` fallback |
| AI UI is hidden | `NEXT_PUBLIC_FEATURE_AI` is unset or false |
| Build works locally but fails on Vercel | Env var missing in Vercel (check all three scopes: Development, Preview, Production) |

---

*Last updated: 2026-06-25 · Maintainer: Michael Wittinger*
