import { defineConfig, devices } from '@playwright/test'

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
