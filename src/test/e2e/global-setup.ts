import { chromium, type FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'admin@inspire2live.org'
const ADMIN_PASSWORD = 'demo1234'
export const AUTH_STATE_PATH = 'src/test/e2e/.auth-state.json'

export default async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Use the service role key (if present in CI) to ensure the test user
  // exists with the correct profile. The seed-demo.sql is never applied
  // in CI/production — only schema migrations run — so demo accounts like
  // admin@inspire2live.org don't exist unless we create them here.
  if (serviceRoleKey && supabaseUrl) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Create the user (no-op if already exists)
    const { data: createData } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })

    // Resolve the user ID — either from create or from listing
    let userId = createData?.user?.id
    if (!userId) {
      const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      userId = list?.users.find((u) => u.email === ADMIN_EMAIL)?.id
    }

    if (userId) {
      await adminClient.from('profiles').upsert(
        {
          id: userId,
          name: 'Platform Admin',
          email: ADMIN_EMAIL,
          role: 'PlatformAdmin',
          organization: 'Inspire2Live',
          country: 'NL',
          onboarding_completed: true,
          comms_team: false,
        },
        { onConflict: 'id' }
      )
    }
  }

  // Sign in via the UI so Next.js sets the SSR session cookies correctly,
  // then persist the storage state for reuse across all tests.
  const baseURL = config.projects.find((p) => p.name === 'chromium')?.use.baseURL ?? 'http://localhost:3000'
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${baseURL}/login`)
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD)
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 })

  await page.context().storageState({ path: AUTH_STATE_PATH })
  await browser.close()
}
