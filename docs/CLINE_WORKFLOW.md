# Cline Git Workflow (historical)

> **Superseded.** This tool-specific document (Cline on Windows/PowerShell) has been
> consolidated into the general, tool-agnostic guidance. It is kept only as a historical
> record of the incidents that shaped the rules.

The living guidance now lives here:

| What you were looking for | Now in |
|---|---|
| Git / commit / branch protocol | [`../AGENTS.md`](../AGENTS.md) §7 and [`SDLC.md`](SDLC.md) |
| Defensive Supabase query pattern (destructure `error`, `try/catch`, `error.tsx`) | [`IMPLEMENTATION_GUIDE.md`](IMPLEMENTATION_GUIDE.md) (Defensive data access) |
| Migration deployment checklist | [`SDLC.md`](SDLC.md) (Database migration lifecycle) and [`../AGENTS.md`](../AGENTS.md) §6 |
| Verify-before-commit gate | [`../AGENTS.md`](../AGENTS.md) §5 |

## Historical context

The original rules were written after three incidents in Feb 2026:

1. **Cline stalled at commit/push** when `git add && git commit && git push` were chained
   in one approval-required call — the fix was to split local commit from remote push into
   separate calls. (Tool-specific to Cline's approval model.)
2. **Multi-line commit messages hung PowerShell** — the fix was single-line commit
   messages and never chaining more than two git commands.
3. **Supabase queries without error handling crashed Server Components** — generalised
   into the Defensive data access rules now in `IMPLEMENTATION_GUIDE.md`.

Incidents 1–2 were specific to the Cline/PowerShell setup and no longer apply to the
current PR-based workflow; incident 3's lesson is now a standing engineering rule.
