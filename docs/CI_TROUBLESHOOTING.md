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

`vercel.json` can use:

```json
"installCommand": "pnpm install --no-frozen-lockfile"
```

This should be treated as temporary. Before merging to `main`, restore frozen installs after `pnpm-lock.yaml` has been regenerated.

## Rule for future dependency changes

Any PR that adds, removes, or changes a package must include the matching `pnpm-lock.yaml` update. Do not leave lockfile regeneration as a follow-up unless the PR remains draft.
