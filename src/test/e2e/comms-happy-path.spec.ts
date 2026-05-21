import { test, expect } from '@playwright/test'

test.describe('Communications happy path', () => {
  test('coordinator can submit intake, route to calendar, and publish', async ({ page }) => {
    const uniqueSuffix = Date.now().toString().slice(-6)
    const senderName = `Sprint 04 E2E ${uniqueSuffix}`
    const draftTitle = `Sprint 04 E2E Draft ${uniqueSuffix}`

    await page.goto('/login')
    await page.getByLabel(/email/i).fill('admin@inspire2live.org')
    await page.getByLabel(/^password$/i).fill('demo1234')
    await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()

    await expect(page).toHaveURL(/\/app\/(dashboard|comms\/intake)/)
    await page.goto('/app/comms/intake')
    await expect(page).toHaveURL(/\/app\/comms\/intake/)

    await page.getByRole('link', { name: /\+ new intake item/i }).click()
    await expect(page).toHaveURL(/\/app\/comms\/intake\/new/)

    await page.getByLabel(/sender name/i).fill(senderName)
    await page.getByLabel(/message content or summary/i).fill(
      'Precision oncology article worth routing to the content calendar for a newsletter draft.'
    )
    await page.getByRole('button', { name: /capture intake item/i }).click()
    await expect(page.getByText(/captured and queued for review/i)).toBeVisible()

    await page.getByRole('link', { name: /back to queue/i }).click()
    await expect(page).toHaveURL(/\/app\/comms\/intake/)

    const intakeCard = page.locator('article').filter({ hasText: senderName }).first()
    await expect(intakeCard).toBeVisible()
    await intakeCard.getByRole('button', { name: /^route$/i }).click()

    const routeModal = page.getByRole('dialog')
    await routeModal.getByLabel(/title override/i).fill(draftTitle)
    await routeModal.getByRole('button', { name: /confirm route/i }).click()

    await expect(routeModal).toBeHidden()

    await page.goto('/app/comms/calendar?view=list')
    const calendarCard = page.locator('article').filter({ hasText: draftTitle }).first()
    await expect(calendarCard).toBeVisible()

    await calendarCard.getByRole('button', { name: /move to scheduled/i }).click()
    await expect(calendarCard.getByRole('button', { name: /move to published/i })).toBeVisible()

    await calendarCard.getByRole('button', { name: /move to published/i }).click()
    await expect(calendarCard.getByRole('button', { name: /move to archived/i })).toBeVisible()
  })
})
