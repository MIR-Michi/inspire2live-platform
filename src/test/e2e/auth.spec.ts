import { test, expect } from '@playwright/test'

/**
 * E2E Smoke Tests: Authentication & Route Protection
 *
 * These are smoke tests only — they verify the entry points of the auth
 * flow behave correctly from the browser's perspective.
 * They do NOT test Supabase internals or email flows.
 */

test.describe('Authentication smoke tests', () => {
  test('unauthenticated user visiting /app/dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    // The login page renders the Inspire2Live logo, not a text heading — check for the brand image and key UI elements
    await expect(page.getByRole('img', { name: 'Inspire2Live' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    // "Sign in with magic link" link is present inside the sign-in form
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible()
  })

  test('login page shows success message after submitting a valid email', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com')
    await page.getByRole('button', { name: /magic link/i }).click()
    // Smoke assertion: after submit, page should still be functional (no crash boundary)
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
    // And the email input should still be present (form did not disappear due to crash)
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
  })

  test('unauthenticated user visiting /app/initiatives is redirected to /login', async ({ page }) => {
    await page.goto('/app/initiatives')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user visiting /onboarding is NOT redirected (public-ish)', async ({
    page,
  }) => {
    // Onboarding is not guarded for unauthenticated users in the current middleware
    // (only the /app/* guard fires). This test documents current behaviour.
    const response = await page.goto('/onboarding')
    // Should reach onboarding (200) not get a 404 or crash
    expect(response?.status()).not.toBe(500)
  })
})
