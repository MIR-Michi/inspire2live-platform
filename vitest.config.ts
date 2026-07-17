import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/test/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/test/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // Unit tests focus on business logic, which since Sprint 16 (ADR-0009)
      // lives in src/lib, each module's domain layer, and non-UI kernel code.
      // UI (src/app, src/components, module ui, kernel ui) is validated via E2E.
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/modules/**/domain/**/*.{ts,tsx}',
        'src/kernel/**/*.{ts,tsx}',
      ],
      exclude: [
        // Shared/component-library UI is browser behavior, not unit-domain logic.
        'src/kernel/ui/**',
        // Thin runtime wrappers around Next/Supabase.
        'src/lib/supabase/**',
        'src/kernel/data/**',
        // Supabase data-layer query files — require live DB or heavy mocking.
        'src/modules/contacts/domain/comms-crm-data.ts',
        'src/modules/events/domain/comms-conference-contacts.ts',
        'src/modules/events/domain/comms-conference-guest-reports.ts',
        'src/modules/events/domain/comms-meeting-transcripts.ts',
        'src/modules/events/domain/comms-event-pipeline.ts',
        'src/modules/events/domain/congress-guest-tokens.ts',
        'src/modules/ai-features/domain/follow-up-tasks-store.ts',
        'src/modules/ai-features/domain/org-newsfeed-job.ts',
        'src/modules/ai-features/domain/org-newsfeed-run.ts',
        'src/modules/content/domain/comms-digest.ts',
        'src/modules/content/domain/comms-integration-intents.ts',
        'src/modules/content/domain/comms-integrations.ts',
        // External API / email dispatch wrappers — no unit-test value.
        'src/modules/intake/domain/whatsapp-send.ts',
        'src/modules/intake/domain/whatsapp-media.ts',
        'src/lib/invitation-email.ts',
        // Depends on Next.js runtime cookies(); cover via E2E.
        'src/lib/view-as.ts',
        'src/types/**',
        'src/app/globals.css',
        '**/*.d.ts',
        'src/test/**',
        'src/app/layout.tsx',
        'src/app/app/layout.tsx',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'server-only': resolve(__dirname, './src/test/mocks/server-only.ts'),
    },
  },
})
