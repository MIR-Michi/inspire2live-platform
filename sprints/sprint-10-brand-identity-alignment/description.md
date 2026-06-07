# Sprint 10 — Brand Identity Alignment

**Phase:** 2 planning backlog
**Status:** In progress — logo asset committed and placed in the app shell; brand colour tokens replaced; typography, email templates, and full visual QC remain

## Goal

Replace the platform's placeholder visual design tokens with Inspire2Live's actual brand identity — wordmark, mark, colour palette, and typography — so the live application matches the organisation's real brand instead of an interim guess.

## Rationale

`docs/PLATFORM_CONCEPT_UPDATE_v1.md` explicitly scoped "visual design system, brand colours" out of the concept phase, and `docs/TRACEABILITY.md` (REQ-DS-001) marks the design token system as only "partial" — it was built ahead of the real brand being available. The current tokens in `src/app/globals.css` use an orange / deep-blue palette (`--color-primary-500: #E8501E`, `--color-secondary-500: #1B4B6B`) that does not reflect Inspire2Live's actual identity.

A reference copy of the Inspire2Live logo was supplied directly for this sprint. Read from that asset, the real identity is built around:

- A lowercase **"inspire2live"** wordmark in a dark charcoal/near-black, with the **"2"** and the dot above the "i" in "live" picked out in a **deep red**.
- A colourful, pointillist/halftone **mark** — a stylised, branch- or figure-like silhouette built from blue, gold/yellow, red-orange, and near-black dots blended in a gradient mosaic. It reads as optimistic, human, and organic — quite different in tone from a corporate flat-colour mark.

This is a markedly different palette and mood from the platform's current orange-led placeholder. This sprint replaces the placeholder tokens with values derived from the canonical brand assets, places the real logo in the app shell (navigation, auth screens, emails), and aligns typography with the brand's actual voice.

**Note on source access:** `https://inspire2live.org` (and `https://www.inspire2live.com`) could not be reached from this environment — the network policy returns `host_not_allowed` for the organisation's domains, and third-party brand-asset mirrors (e.g. Brandfetch) are blocked too. The analysis above is therefore based solely on the attached logo file. The first task in this sprint is to obtain the organisation's canonical brand kit (vector logo files, palette swatches with hex values, and type specimens) so the implementation isn't working from inference alone.

## Safety guardrails

- This is a **token and asset substitution**, not a redesign — do not change component structure, layout, or information architecture.
- Preserve WCAG AA contrast ratios when swapping colour values; re-check every text-on-background and button combination that changes, not just the primary brand colour.
- Keep the **semantic token names** (`--color-primary-*`, `--color-secondary-*`, `--color-success`, `--color-warning`, `--color-danger`, neutral scale, etc.) stable so existing Tailwind utility classes keep resolving — change values, not names, unless a brand colour genuinely needs a new semantic slot.
- Do not let the new brand red collide with the **RAG (red/amber/green) status system** — those colours are functional (milestone health), not decorative, and must stay visually distinct from any brand-red accents (e.g. via the existing icon+text pairing per REQ-A11Y-003).
- Ship logo assets as optimised **SVG** (with PNG fallbacks) in both a full lock-up (mark + wordmark) and a compact mark-only variant, and in light- and dark-background-safe treatments, so the logo stays legible in the nav, auth pages, and exported/printed content such as invitation emails.

## Acceptance criteria

- The Inspire2Live wordmark + mark is added to the repo as optimised SVG/PNG assets under `public/brand/` and rendered in the top navigation, mobile drawer, and auth screens, replacing the current text-only header treatment.
- `src/app/globals.css` design tokens (`--color-primary-*`, `--color-secondary-*`, neutral scale, semantic colours) are updated to match the real brand palette pulled from canonical assets, with the resulting hex values documented in `docs/IMPLEMENTATION_GUIDE.md` §7 (Design System Quick Reference).
- Typography tokens reflect the brand's actual typeface (or the nearest licensed web-safe equivalent if the brand font is proprietary), replacing the current Inter/Geist placeholder documented in `docs/IMPLEMENTATION_GUIDE.md` §7.
- `docs/TRACEABILITY.md` REQ-DS-001 is updated from "partial / placeholder" to reflect the finalised, brand-accurate token set.
- A documented visual smoke pass (manual or E2E, with before/after screenshots) confirms the navigation, dashboard, auth flow, comms workspace, and transactional emails render correctly with the new tokens, with **no contrast regressions** and the RAG status colours remaining clearly distinguishable from the new brand red.

## Out of scope

- Full visual redesign of layouts, components, or information architecture — only design tokens, logo placement, and typography change.
- Brand voice / copywriting / tone-of-voice guidelines — colours, type, and logo usage only.
- Print collateral, social templates, or other non-platform brand assets.
