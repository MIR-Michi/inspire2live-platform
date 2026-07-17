# fix: Dashboard design editing and persistence UX

- **Date:** 2026-07-17
- **Author:** OpenAI
- **Type:** fix
- **Scope:** dashboards, platform settings, app shell
- **Links:** REQ-DASH-002 · REQ-DASH-003 · REQ-DASH-006 · REQ-DASH-008

## Context

Dashboard editing could expose a large white overflow area, native tile drag-and-drop frequently landed in the wrong position or failed to communicate a valid target, and organization Design settings could not save because the settings table's composite primary key implicitly made the kernel-only `component_id` column non-null.

## Change

- Corrected `platform_settings` so kernel rows can store `component_id = null`, and validate a complete settings change set before writing.
- Made the Design panel show the exact changed setting, highlight the affected preview area, track unsaved values, and display prominent save success or actionable error feedback.
- Reworked dashboard dragging around a dedicated handle, compact drag preview, before/after insertion lines, explicit end-of-column targets, reliable event propagation, and visual-index correction.
- Constrained the application shell with dynamic viewport height, horizontal clipping, and contained overscroll to prevent white overflow strips during editing.

## Verification

- Unit coverage added for nullable kernel settings, all-fields-before-write validation, visible-lane ordering, and visual drop-index translation.
- Dashboard browser smoke expectations updated for the dedicated drag handle and edit guidance.
- Full repository CI, migration replay, and Vercel preview are required before merge.

## Risk & rollback

Medium-low. Migration `00169` removes an incompatible primary-key constraint but preserves the existing coalesced unique index, RLS, logical key, and all stored rows. UI changes are limited to dashboard editing, the Design settings page, and overflow containment in the authenticated app shell.

## Follow-ups

None planned; production feedback should be used to tune target sizes or animation intensity if needed.
