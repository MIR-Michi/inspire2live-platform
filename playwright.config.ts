import { defineConfig, devices } from '@playwright/test'
import { AUTH_STATE_PATH } from './src/test/e2e/global-setup'

export default defineConfig({
  testDir: './src/test/e2e',
  globalSetup: './src/test/e2e/global-setup',
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
    // Unauthenticated tests (auth smoke, redirects)
    {
      name: 'chromium',
      testIgnore: '**/comms-happy-path.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // Authenticated tests — reuse the session saved by globalSetup
    {
      name: 'chromium-auth',
      testMatch: '**/comms-happy-path.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_PATH,
      },
    },
  ],

  webServer: {
    // In CI: use the production build (reliable, no hot-reload overhead).
    // Locally: use dev server for fast iteration.
    // In CI the quality job builds and uploads .next as an artifact;
    // the E2E job downloads it, so we only need `next start` here.
    // Locally, use the dev server for fast iteration.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI && process.env.PW_FORCE_FRESH_SERVER !== 'true',
    // Production build + startup can take up to 3 min on cold CI runners
    timeout: 180_000,
  },
})
