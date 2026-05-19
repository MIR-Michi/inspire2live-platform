import { expect, test } from '@playwright/test'

async function openIntakeQueue(page: import('@playwright/test').Page) {
  if (/\/app\/comms\/intake/.test(page.url())) {
    await expect(page).toHaveURL(/\/app\/comms\/intake/)
    return
  }

  await page.getByRole('link', { name: /^Communications$/i }).click()
  await expect(page).toHaveURL(/\/app\/comms/)
  await page.locator('a[href="/app/comms/intake"]').click()
  await expect(page).toHaveURL(/\/app\/comms\/intake/)
}

test.describe('Communications webhook ingestion', () => {
  test('coordinator can review webhook classification, correct it, and replay it', async ({ page, request }) => {
    const uniqueSuffix = Date.now().toString().slice(-6)
    const senderName = `Webhook Sprint 05 ${uniqueSuffix}`
    const senderWhatsappId = `43660${uniqueSuffix}`
    const providerMessageId = `wamid.sprint05.${uniqueSuffix}`

    const webhookResponse = await request.post('/api/comms/whatsapp', {
      data: {
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ wa_id: senderWhatsappId, profile: { name: senderName } }],
                  messages: [
                    {
                      id: providerMessageId,
                      from: senderWhatsappId,
                      type: 'text',
                      text: {
                        body: 'Please review this article for the comms queue https://example.org/automation-story',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    })

    expect(webhookResponse.ok()).toBeTruthy()
    await expect(async () => {
      const body = await webhookResponse.json()
      expect(body.accepted).toBe(1)
    }).toPass()

    await page.goto('/login')
    await page.getByLabel(/email/i).fill('atefeh@inspire2live.org')
    await page.getByLabel(/^password$/i).fill('demo1234')
    await page.locator('form').getByRole('button', { name: /^sign in$/i }).click()

    await expect(page).toHaveURL(/\/app\/(dashboard|comms\/intake)/)
    await openIntakeQueue(page)

    const intakeCard = page.locator('article').filter({ hasText: senderName }).first()
    await expect(intakeCard).toBeVisible()
    await expect(intakeCard.getByText('Webhook', { exact: true })).toBeVisible()
    await expect(intakeCard.getByText('Article Share', { exact: true })).toBeVisible()
    await expect(intakeCard.getByText(/External article URL/i)).toBeVisible()

    await intakeCard.getByRole('button', { name: /edit classification/i }).click()
    const modal = page.getByRole('dialog', { name: /edit classification/i })
    await expect(modal.getByText(/Automation review/i)).toBeVisible()
    await modal.getByLabel(/content type/i).selectOption('initiative_update')
    await modal.getByLabel(new RegExp(`Create a reusable sender rule for ${senderName}`)).check()
    await modal.getByRole('button', { name: /save correction/i }).click()
    await expect(modal).toBeHidden()

    await expect(intakeCard.getByText('Initiative Update', { exact: true })).toBeVisible()
    await expect(intakeCard.getByText(/corrected/i)).toBeVisible()

    await intakeCard.getByRole('button', { name: /edit classification/i }).click()
    const replayModal = page.getByRole('dialog', { name: /edit classification/i })
    await replayModal.getByRole('button', { name: /replay classifier/i }).click()
    await expect(replayModal).toBeHidden()

    await expect(intakeCard.getByText('Initiative Update', { exact: true })).toBeVisible()
    await expect(intakeCard.getByText(/replayed/i)).toBeVisible()
  })
})
