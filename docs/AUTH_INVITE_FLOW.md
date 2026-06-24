# Invitation → password setup flow

How an invited user goes from email link to a working account, and the Supabase
settings it depends on.

## Flow

1. An admin invites someone (Admin → Users → Invite User). The
   `inviteUserAccount` **server action** calls the Supabase **Admin API**
   `auth.admin.inviteUserByEmail(email, { data: { role }, redirectTo: <appUrl>/auth/confirm })`,
   which creates the auth user (no password yet) and emails a token-hash invite
   link. The confirm URL is built with `getAuthBaseUrl` — it prefers the
   canonical `NEXT_PUBLIC_APP_URL` and falls back to the admin's browser origin,
   so invites sent from a preview deployment still land on the allow-listed
   production domain.
   > `redirectTo` points to `/auth/confirm` (the interstitial), **not**
   > `/auth/callback` directly. If it pointed to `/auth/callback` and the
   > production Supabase project uses the default email template
   > (`{{ .ConfirmationURL }}`), the link would go through Supabase's verify
   > endpoint which forwards to `redirectTo` — and a link-scanner pre-fetch
   > would call `verifyOtp` on GET, consuming the single-use token before the
   > real user clicks. See "Email-link scanners" below.
   >
   > This replaced an earlier client-side `signInWithOtp` invite, whose PKCE
   > verifier was bound to the *admin's* browser, so the invitee could never
   > complete the link (it failed as "expired or already used"). The Admin API
   > requires `SUPABASE_SERVICE_ROLE_KEY` to be set in the deployment env.
2. The email link points at the **`/auth/confirm`** interstitial, not directly at
   the callback. That page does **not** verify on load — it only renders a
   "Continue" button that **POSTs** the token to `/auth/callback`. See
   "Email-link scanners" below for why.
3. Clicking Continue verifies at **`/auth/callback`** (POST), which establishes
   the invitee's session and forwards to **`/setup-password?email=<their email>`**.
   A `handle_new_user` trigger has already created their `profiles` row with
   `onboarding_completed = false`.
4. The invitee chooses a password (entered twice, show/hide, remember-me). We set
   `user_metadata.password_set = true` so future magic-link sign-ins skip this step.
5. They continue to **`/onboarding`**, then their dashboard.

`/auth/callback` accepts both verification styles, over GET (direct link) or POST
(from `/auth/confirm`):

- `token_hash` + `type` — verified with `verifyOtp`. **Preferred**: no PKCE
  verifier needed, so it works when the invitee opens the email on a different
  device than the inviter used.
- `code` — verified with `exchangeCodeForSession` (PKCE; same-browser only).

### Email-link scanners (Microsoft 365 SafeLinks etc.)

Single-use tokens are destroyed by mail-security scanners that **pre-fetch** links
to inspect them (Outlook/Defender "SafeLinks" is the common one). A
verify-on-GET callback gets consumed by that scan, so the human's later click
fails as "expired or already used". The `/auth/confirm` interstitial sidesteps
this: the scanner pre-opens harmless HTML, and the token is only spent on the
explicit **POST** when the person clicks Continue. This is why the email
templates must point at `/auth/confirm`, not `/auth/callback`.

If a **different** account is already signed in, `/setup-password` detects the
mismatch (compares `?email=` to the session) and offers "Sign out & set up
<invited>" or "Keep using <current>" instead of silently taking over.

## Required Supabase settings (hosted project)

`supabase/config.toml` only governs local dev. The hosted project must be set in
the Dashboard:

1. **Authentication → URL Configuration**
   - **Site URL**: the production origin, e.g. `https://app.inspire2live.org`.
   - **Redirect URLs**: must include the callback, e.g.
     `https://app.inspire2live.org/auth/callback` (add the localhost/preview
     equivalents too). If this is missing, Supabase falls back to the Site URL and
     the invitee lands on `/` → `/login` instead of password setup.
2. **Authentication → Email Templates** — set the **Magic Link** and **Invite**
   templates to link to the `/auth/confirm` interstitial with a token hash
   (mirrors `supabase/templates/*.html`):
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/setup-password
   ```
   (use `type=invite` for the Invite template). Pointing these at `/auth/callback`
   directly will break for recipients behind link scanners — see "Email-link
   scanners" above.
3. Make sure the deployment env var **`NEXT_PUBLIC_APP_URL`** matches the
   production origin so the callback URL is built correctly.

## Required deployment env vars (Vercel)

| Var | Why |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Hard requirement.** `inviteUserAccount` creates the admin client to call `inviteUserByEmail`. Without it, inviting fails with *"Server is not configured for invitations (missing service role key)."* |
| `NEXT_PUBLIC_APP_URL` | Canonical production origin; used to build the invite callback URL. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Standard Supabase client config. |

## Production email delivery

The signup invite is sent by **Supabase's own auth mailer** (not the
Resend/SendGrid path in `lib/invitation-email.ts`, which serves the separate
in-app initiative/congress invitations). Supabase's built-in SMTP is rate-limited
(see `auth.rate_limit.email_sent`) and not meant for production, so configure a
real SMTP provider in **Dashboard → Authentication → Emails → SMTP Settings** or
invites may silently not arrive.

## Quick end-to-end test

1. Sign in as a PlatformAdmin → Admin → Users → **Invite User**, enter a real
   inbox you control and a role.
2. Confirm the invite email arrives. Open the link **on a different device** to
   confirm the token-hash (non-PKCE) path works.
3. You should land on `/setup-password`, set a password, continue to
   `/onboarding`, then the role's dashboard.
4. Sign out and sign back in with the new password to confirm `password_set`
   skips the setup step.
