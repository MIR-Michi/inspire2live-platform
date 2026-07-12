# Feedback (`feedback`)

In-app contextual feedback capture and the admin triage surface. **The reference
component** for the modular architecture (ADR-0009 / S16-T05): the first module
converted end-to-end. Copy this layout for the other components.

- **Surface:** internal
- **DB schema (target):** `feedback` · **owns:** `feedback_items`
- **Depends on:** kernel [identity, rbac, data]
- **Feature flag:** _(always on)_
- **Requirements:** REQ-FEEDBACK-001

## Layout

```
feedback/
  manifest.ts        declarative contract (provides = the index.ts exports)
  index.ts           PUBLIC API — the only import surface for app routes / other modules
  domain/
    types.ts         FeedbackItem + type/status metadata + shortUrl()
    repository.ts    reads: requireFeedbackAdmin, loadFeedbackItems, loadFeedbackStatusCounts
    actions.ts       'use server' writes: createFeedbackItem, updateFeedbackStatus, deleteFeedbackItem
  api/
    export.ts        handleFeedbackExport(request) — Markdown export handler logic
  ui/
    feedback-overlay.tsx        the floating tester widget (mounted in app layout)
    feedback-items-list.tsx     admin list
    feedback-status-select.tsx  admin per-item control
    feedback-delete-button.tsx  admin per-item control
    test-mode-context.tsx       TestModeProvider / useTestMode
```

## How the app consumes it

The Next.js routes stay thin and import only from `@/modules/feedback`:

- `app/app/layout.tsx` → `TestModeProvider`, `FeedbackOverlay`
- `app/app/admin/feedback/page.tsx` → `requireFeedbackAdmin`, `loadFeedbackItems`,
  `loadFeedbackStatusCounts`, `FeedbackItemsList`
- `app/app/admin/feedback/export/route.ts` → `handleFeedbackExport`

Nothing outside the module imports its internals — the import-boundary governance
check (S16-T03a) enforces this. This conversion is a pure move: no behaviour
change, existing routes and the tester overlay work exactly as before.
