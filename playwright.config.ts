import { defineConfig, devices } from '@playwright/test'

const playwrightWhatsappWebhookSecret =
  process.env.WHATSAPP_WEBHOOK_SECRET ?? 'playwright-local-whatsapp-secret'
const useProdServer = process.env.PW_USE_PROD_SERVER === 'true' || !!process.env.CI
const playwrightSupabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const playwrightSupabaseAnonKey =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const playwrightSupabaseServiceRoleKey =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Smoke tests use Chromium only — fast and reliable for MVP phase
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Production-mode runs are slower, but much more stable for auth and routing checks.
    // Opt in locally with PW_USE_PROD_SERVER=true.
    command: useProdServer ? 'pnpm build && pnpm start' : 'pnpm dev',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: playwrightSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: playwrightSupabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: playwrightSupabaseServiceRoleKey,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      WHATSAPP_WEBHOOK_SECRET: playwrightWhatsappWebhookSecret,
    },
    url: 'http://localhost:3000',
    reuseExistingServer: !useProdServer && process.env.PW_FORCE_FRESH_SERVER !== 'true',
    // Production build + startup can take up to 3 min on cold CI runners
    timeout: 180_000,
  },
})
