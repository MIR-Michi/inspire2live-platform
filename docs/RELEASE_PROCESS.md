# Release & Deployment Process — Inspire2Live Platform

> **Purpose:** How code moves from development to production, versioning strategy, hotfix flow.  
> **Audience:** Developers, release managers, platform administrators.  
> **Last reviewed:** 2026-02-24

---

## 1 · Deployment Architecture

```
Developer workstation
    │
    │ git push origin main
    ▼
GitHub (main branch)
    │
    ├── GitHub Actions CI ──► quality gate + tests
    │
    ▼
Vercel (auto-deploy on push to main)
    │
    ├── Preview deployment (PRs / branches)
    └── Production deployment (main branch)

Supabase (database)
    │
    ├── Validated in CI (db-migrations.yml — applies migrations + seed to a
    │   throwaway local stack on every PR/push touching supabase/)
    └── Auto-applied to production on merge to main (deploy-vercel.yml runs
        `supabase db push` before the Vercel deploy). Manual `supabase db push`
        remains the hotfix path.
```

### Key characteristic

**Trunk-based, continuously deployed.** Every push to `main` that passes CI goes to production automatically via Vercel. There is no staging environment (yet).

---

## 2 · Versioning Strategy

### Semantic Versioning (semver)

```
MAJOR.MINOR.PATCH
  │      │     │
  │      │     └── Bug fixes, patches (no API/schema changes)
  │      └──────── New features, non-breaking additions
  └─────────────── Breaking changes (schema, API, role model)
```

### Current version

Tracked in `package.json` → `"version": "0.1.0"`

### Version bump rules

| Change Type | Example | Version Bump |
|-------------|---------|-------------|
| Bug fix, typo, CSS fix | Fix auth redirect | PATCH (0.1.0 → 0.1.1) |
| New feature, new page | Add invitation system | MINOR (0.1.0 → 0.2.0) |
| Breaking schema change | Rename role column | MAJOR (0.x → 1.0.0) |
| Migration-only change | Add new table | MINOR |

### When to bump

- **After each significant feature batch** (not every commit).
- Update `package.json` version + add entry to `CHANGELOG.md`.
- Tag the commit: `git tag v0.2.0 && git push --tags`

---

## 3 · Release Checklist

Before each planned release:

### Pre-release

- [ ] All CI checks pass on `main`
- [ ] `pnpm test` — all unit tests green
- [ ] `pnpm typecheck` — no TypeScript errors
- [ ] `pnpm build` — production build succeeds
- [ ] Database migrations applied to production Supabase
- [ ] Environment variables verified on Vercel (see `ENVIRONMENT_REFERENCE.md`)
- [ ] CHANGELOG.md updated with new entries
- [ ] Version bumped in `package.json`

### Deploy

- [ ] Push to `main` (auto-deploys to Vercel)
- [ ] Verify production site loads: `https://inspire2live-platform.vercel.app`
- [ ] Verify health endpoint: `GET /api/version` returns new version
- [ ] Smoke test critical paths: login, dashboard, navigate to initiatives

### Post-release

- [ ] Tag the release: `git tag v0.X.Y && git push --tags`
- [ ] Notify stakeholders (if user-facing changes)
- [ ] Monitor Vercel logs for 30 minutes post-deploy

---

## 4 · Hotfix Process

For urgent fixes to production:

```
1. Fix directly on `main` (trunk-based)
2. Run full test suite locally: pnpm test && pnpm typecheck
3. Push to main
4. CI validates → Vercel auto-deploys
5. Verify fix in production
6. If fix involves DB: push migration first, then deploy code
```

### If the fix is too risky for direct push

1. Create branch: `hotfix/describe-issue`
2. Open PR against `main`
3. Wait for CI to pass
4. Merge → auto-deploy
5. Delete hotfix branch

---

## 5 · Database Migration Deployment

Database schema changes require special handling because **migrations are irreversible**.

### Automated flow (default)

Migrations are part of CD — you normally do **not** push them by hand:

```
1. Write migration in supabase/migrations/NNNNN_description.sql
2. Open a PR
   └─ CI `db-migrations.yml` applies it (+ seed) to a throwaway local stack.
      A broken migration fails the check here, before merge.
3. Merge to main
   └─ `deploy-vercel.yml` runs `supabase db push` (migrations applied to
      production) and THEN builds + deploys the code. Ordering is guaranteed:
      the deploy step only runs after the migration step succeeds.
```

This guarantees the safe order automatically: **migration applied → then code deployed.**

### Why order matters

If code deploys before migration → server actions will fail because tables/columns don't exist yet.
If migration deploys before code → old code ignores new columns (safe). The deploy workflow enforces
migration-first by running `supabase db push` before the Vercel build.

### Manual fallback (hotfix only)

```
1. Test locally:        supabase db reset
2. Push to remote DB:    pnpm db:push      (or pnpm db:push:win on Windows)
3. Verify applied:       supabase migration list
```

---

## 6 · Rollback Procedures

### Code rollback (Vercel)

Vercel keeps every deployment as an immutable snapshot:

1. Vercel Dashboard → Deployments
2. Find last known-good deployment
3. Click ⋯ → **Promote to Production**
4. Takes effect in < 30 seconds

### Database rollback

There is no automatic rollback for migrations. See `INCIDENT_RESPONSE.md` §5 for the manual reversal migration procedure.

---

## 7 · Environment Promotion (Future)

Current state: **no staging environment** — trunk-based to production.

### Planned (Phase 2+)

```
Developer → PR Preview (Vercel) → main → Production (Vercel)
                                    │
                                    └── Supabase Branching (when available)
```

| Environment | Purpose | URL | Database |
|-------------|---------|-----|----------|
| Local | Development | http://localhost:3000 | Local Supabase or remote dev project |
| Preview | PR review | Auto-generated Vercel URL | Production DB (read-only ideally) |
| Production | Live users | https://inspire2live-platform.vercel.app | Production Supabase |

### Feature flags

Use environment variables to gate unreleased features:

```
NEXT_PUBLIC_FEATURE_CONGRESS=false
NEXT_PUBLIC_FEATURE_HUBS=false
NEXT_PUBLIC_FEATURE_PARTNERS=false
```

Toggle in Vercel env settings without redeploying.

---

## 8 · Deployment Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails on Vercel | Check GitHub Actions logs first; usually TypeScript error |
| "Module not found" in production | Verify import paths use `@/` alias, not relative |
| Migration fails on push | Check if migration is idempotent; use `IF NOT EXISTS` |
| Environment variable missing | Vercel → Settings → Environment Variables; redeploy after adding |
| Old version still showing | Clear Vercel cache: Vercel Dashboard → Settings → Data Cache → Purge |

---

*Last updated: 2026-02-24 · Maintainer: Michael Wittinger*
