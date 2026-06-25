# CI Troubleshooting

## Vercel or GitHub install fails with ERR_PNPM_OUTDATED_LOCKFILE

Symptom:

```text
ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile"
specifiers in the lockfile don't match specifiers in package.json
```

Cause:

`package.json` was changed, but `pnpm-lock.yaml` was not regenerated in the same branch. This happened during Sprint 14 after adding `@anthropic-ai/sdk`.

Permanent fix:

```bash
pnpm install --lockfile-only
```

Then commit both files:

```bash
git add package.json pnpm-lock.yaml
git commit -m "fix: update pnpm lockfile"
```

Temporary preview-build workaround:

`vercel.json` and GitHub Actions can temporarily use:

```text
pnpm install --no-frozen-lockfile
```

This should be treated as temporary. Before merging to `main`, restore frozen installs after `pnpm-lock.yaml` has been regenerated.

## Supabase migration fails with duplicate schema_migrations version

Symptom:

```text
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(00071) already exists.
```

Cause:

Two migration files share the same numeric prefix. Supabase tracks the prefix as the migration version, so `00071_ai_foundation.sql` conflicts with `00071_campus_agenda_and_meeting_notes.sql` even if the filenames differ.

Fix:

1. Find the latest migration number already present on `main`.
2. Rename the new migration to the next free number.
3. Delete the conflicting migration file from the branch.
4. Re-run the DB Migrations workflow.

Sprint 14 fix applied:

`00071_ai_foundation.sql` was moved to `00076_ai_foundation.sql` because `main` already uses `00071` through `00075`.

## Rule for future dependency and migration changes

Any PR that adds, removes, or changes a package must include the matching `pnpm-lock.yaml` update. Any PR that adds a migration must use a numeric prefix that is not already present on `main`. Do not leave lockfile regeneration as a follow-up unless the PR remains draft.
