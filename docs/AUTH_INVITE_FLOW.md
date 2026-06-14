# Invitation → password setup flow

How an invited user goes from email link to a working account, and the Supabase
settings it depends on.

## Flow

1. An admin invites someone (Admin → Users → Invite User). This calls
   `signInWithOtp({ email, options: { data: { role }, emailRedirectTo: <origin>/auth/callback } })`,
   which creates the auth user (no password yet) and emails a confirmation link.
2. The invitee clicks the link. It verifies at **`/auth/callback`**, which
   establishes their session and forwards to **`/setup-password?email=<their email>`**.
3. The invitee chooses a password (entered twice, show/hide, remember-me). We set
   `user_metadata.password_set = true` so future magic-link sign-ins skip this step.
4. They continue to **`/onboarding`**, then their dashboard.

`/auth/callback` accepts both verification styles:

- `?token_hash=…&type=…` — verified with `verifyOtp`. **Preferred**: no PKCE
  verifier needed, so it works when the invitee opens the email on a different
  device than the inviter used.
- `?code=…` — verified with `exchangeCodeForSession` (PKCE; same-browser only).

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
   templates to link to the callback with a token hash (mirrors
   `supabase/templates/*.html`):
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/setup-password
   ```
   (use `type=invite` for the Invite template).
3. Make sure the deployment env var **`NEXT_PUBLIC_APP_URL`** matches the
   production origin so `emailRedirectTo` is built correctly.
