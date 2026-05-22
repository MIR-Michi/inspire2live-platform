# Sprint 05 — Intake Automation & Classification

**Phase:** 2 draft backlog
**Status:** In Progress (security and data-integrity hardening complete; awaiting sprint review before any push)

## Goal

Replace the manual-only capture bottleneck with structured intake automation while keeping human review in control.

## Rationale

Sprint 04 proves the communications workflow operationally. The next highest-leverage step is reducing coordinator effort in the intake layer without sacrificing trust, auditability, or signal quality.

## Acceptance criteria

- [x] WhatsApp Business API webhook lands raw inbound messages in the intake queue.
- [x] Rule-based classification pre-fills content type, confidence, and Peter/founder signals.
- [x] Manual coordinator correction remains available on every captured item.
- [x] Classification corrections are reusable as system rules or training examples.
- [x] Delivery notes from the Sprint 04 pilot are reflected in the intake workflow.

## Verification summary

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test` (`211/211`)
- `pnpm build`
- `pnpm dlx supabase@2.76.10 db push --local`
- `pnpm dlx supabase@2.76.10 db lint --local --fail-on error`
- `PW_USE_PROD_SERVER=true PW_FORCE_FRESH_SERVER=true pnpm exec playwright test src/test/e2e/comms-happy-path.spec.ts src/test/e2e/comms-webhook-ingestion.spec.ts --project=chromium --workers=1`

## Delivery notes reflected in the workflow

- Automated intake stays in the same queue as manual capture so coordinators never lose context.
- Every automation result shows explainable reasoning instead of opaque labels.
- Corrections stay lightweight: fix the type, optionally promote a sender rule, and replay without leaving the queue.
