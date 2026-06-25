# Inspire2Live Platform

A Next.js 16 application built with Supabase, Tailwind CSS v4, and deployed on Vercel.

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local DB)

### 1. Clone & Install

```bash
git clone <repo-url>
cd inspire2live-platform
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 3. Run the Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Vercel Deployment

### Required Environment Variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) | ✅ |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL | ✅ |
| `NEXT_PUBLIC_APP_NAME` | Display name of the app | ✅ |
| `RESEND_API_KEY` | Resend API key for emails | ✅ |
| `CRON_SECRET` | Secret for protected cron endpoints | ✅ |
| `ANTHROPIC_API_KEY` | Server-side fallback for Claude when no admin-managed AI credential exists | optional |
| `AI_SETTINGS_ENCRYPTION_KEY` | Server-side encryption material for admin-managed AI credentials | required for stored AI credentials |
| `NEXT_PUBLIC_FEATURE_CONGRESS` | Enable Congress feature | optional |
| `NEXT_PUBLIC_FEATURE_HUBS` | Enable Hubs feature | optional |
| `NEXT_PUBLIC_FEATURE_PARTNERS` | Enable Partners feature | optional |
| `NEXT_PUBLIC_FEATURE_AI` | Enable Sprint 14 AI UI and server calls | optional |

> **Important:** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `AI_SETTINGS_ENCRYPTION_KEY` must be set as **Server-side only** variables in Vercel where applicable. Never expose them to the browser.

### Supabase Auth Callback URL

In your Supabase project → **Authentication → URL Configuration**, add:

```
https://<your-vercel-url>/auth/callback
```

Also add your Vercel preview URLs if using preview deployments:
```
https://<your-project>-*.vercel.app/auth/callback
```

### Vercel Project Settings

The repository root contains a `vercel.json` that sets:
- **Root Directory:** `inspire2live-platform`
- **Build Command:** `pnpm build`
- **Install Command:** `pnpm install --frozen-lockfile`

These are applied automatically when you connect the repo to Vercel.

### Automated Production Deployment (GitHub Actions → Vercel)

This repository includes a dedicated workflow:

- `.github/workflows/deploy-vercel.yml`

How it works:

1. CI workflow (`CI`) runs on push.
2. When CI succeeds for `main`, the deploy workflow triggers automatically.
3. The deploy workflow uses Vercel CLI to:
   - pull production environment/project settings,
   - build artifacts,
   - deploy to **production** with `--prebuilt --prod`.

Required GitHub repository secrets:

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Auth token for Vercel CLI |
| `VERCEL_ORG_ID` | Your Vercel team/user org ID |
| `VERCEL_PROJECT_ID` | Target Vercel project ID |

> You can get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from Vercel project settings or by running `vercel link` locally and checking `.vercel/project.json`.

Verification checklist:

1. Push a commit to `main`.
2. Confirm GitHub Actions shows:
   - `CI` ✅
   - `Deploy to Vercel (Production)` ✅
3. Confirm Vercel production deployment points to the same commit SHA.

---

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests (requires a running dev server)
pnpm test:e2e
```

---

## 🛠 Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:coverage` | Unit tests with coverage |
| `pnpm test:e2e` | E2E tests (Playwright) |

---

## 🗄 Database

Supabase migrations are in `supabase/migrations/`. To apply them to your cloud project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

To run locally with Docker:

```bash
supabase start
# Then update .env.local with the local keys printed by the CLI
```

---

## 🧭 Two-layer roles (Platform permissions + Congress responsibilities)

This app uses a **2-layer role model** to prevent permission spaghetti:

### Layer 1 — Platform role (permissions)
Stored on `profiles.role`.

- Answers: **“Can I do this type of action?”**
- Example: creating/updating objects, approving decisions, editing RAID entries.

In v1, write access remains aligned with the existing DB helper:
`is_coordinator_or_admin()` ⇒ `HubCoordinator` or `PlatformAdmin`.

### Layer 2 — CongressAssignment (responsibility)
Stored in `public.congress_assignments` (migration `00013_congress_assignments.sql`).

- Answers: **“Where / for what am I responsible?”**
- Does **not** grant extra permissions (no hidden overrides).
- Fields:
  - `user_id`, `congress_id`
  - `project_role` (e.g. Congress Lead, Ops Lead, Comms Lead, …)
  - scope: `scope_all` or `workstream_ids[]`
  - `effective_from` / `effective_to`

### UI behavior
- The UI always shows both layers (TopNav role chips).
- Congress Workspace pages show a clear **“Why you can / can’t edit”** message.

### Key user journeys
- If you **can edit** (platform role allows it) but have **no congress assignment**, you can still edit — but the UI will warn that responsibility-focused views may be less targeted.
- If you **have a congress assignment** but your **platform role is read-only**, the UI will surface the conflict and instruct you to contact a coordinator/admin.


## 📁 Project Structure

```
inspire2live-platform/
├── src/
│   ├── app/            # Next.js App Router pages & layouts
│   ├── components/     # Reusable UI components
│   ├── lib/            # Business logic, Supabase clients, utilities
│   ├── types/          # TypeScript types (incl. generated DB types)
│   └── test/           # Unit and E2E tests
├── supabase/
│   ├── migrations/     # SQL migration files
│   └── seed*.sql       # Seed data scripts
├── docs/               # Architecture docs, ADRs, roadmap, concept updates
├── sprints/            # Active delivery — sprint folders with description + tasks
├── .env.example        # Environment variable template
└── next.config.ts      # Next.js configuration
```

> **Current MVP scope:** Communications Workspace pilot — see `docs/PLATFORM_CONCEPT_UPDATE_v1.md` and `sprints/README.md`. The previously-shipped initiative workspace, bureau, congress slice, resource library, and partner portal remain in the codebase as Phase 2 surface area.
