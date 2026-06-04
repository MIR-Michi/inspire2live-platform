import { describe, expect, it } from 'vitest'
import { classifyIntakeItem, parseSourceUrl } from '@/lib/comms-classifier'
import { parseWhatsAppWebhookPayload } from '@/lib/comms-webhook'

describe('communications classifier', () => {
  it('classifies external links as article shares with explainable reasons', () => {
    const result = classifyIntakeItem({
      senderName: 'Kai Bergmann',
      rawContent: 'Worth sharing in the next newsletter https://example.org/precision-oncology-update',
      sourceUrl: 'https://example.org/precision-oncology-update',
    })

    expect(result.contentType).toBe('article_share')
    expect(result.confidence).toBe('high')
    expect(result.reasoning.some((reason) => reason.ruleId === 'builtin:source-url-article')).toBe(true)
  })

  it('elevates Peter messages to founder signals', () => {
    const result = classifyIntakeItem({
      senderName: 'Peter Kapitein',
      rawContent: 'Please welcome Michael from Austria into the World Campus circle.',
    })

    expect(result.isPeterKapitein).toBe(true)
    expect(result.confidence).toBe('high')
    expect(result.reasoning.some((reason) => reason.effect === 'founder_signal')).toBe(true)
  })

  it('honours higher-priority external rules ahead of built-in heuristics', () => {
    const result = classifyIntakeItem(
      {
        senderName: 'Automation QA',
        rawContent: 'Please review this workshop summary https://example.org/workshop',
        sourceUrl: 'https://example.org/workshop',
      },
      [
        {
          id: 'custom:automation-qa',
          name: 'Automation QA sender override',
          matchField: 'sender_name',
          matchType: 'exact',
          pattern: 'Automation QA',
          suggestedContentType: 'initiative_update',
          suggestedConfidence: 'high',
          marksPeter: false,
          priority: 400,
        },
      ]
    )

    expect(result.contentType).toBe('initiative_update')
    expect(result.confidence).toBe('high')
    expect(result.matchedRuleIds[0]).toBe('custom:automation-qa')
  })

  it('treats an exact sender override as decisive during replay classification', () => {
    const result = classifyIntakeItem(
      {
        senderName: 'Webhook Sprint 05 Override',
        rawContent: 'Please review this article for the comms queue https://example.org/automation-story',
        sourceUrl: 'https://example.org/automation-story',
      },
      [
        {
          id: 'custom:sender-override',
          name: 'Sender override',
          matchField: 'sender_name',
          matchType: 'exact',
          pattern: 'Webhook Sprint 05 Override',
          suggestedContentType: 'initiative_update',
          suggestedConfidence: 'high',
          marksPeter: false,
          priority: 280,
        },
      ]
    )

    expect(result.contentType).toBe('initiative_update')
    expect(result.confidence).toBe('high')
    expect(result.matchedRuleIds[0]).toBe('custom:sender-override')
  })

  it('classifies podcast mentions as event reports', () => {
    const result = classifyIntakeItem({
      senderName: 'Podcast Producer',
      rawContent: 'Podcast episode recording with our new guest is confirmed for Thursday.',
    })

    expect(result.contentType).toBe('event_report')
    expect(result.confidence).toBe('high')
    expect(result.reasoning.some((reason) => reason.ruleId === 'builtin:event-keywords')).toBe(true)
  })

  it('extracts the first source URL from raw text', () => {
    expect(parseSourceUrl('More context here https://example.org/report and more text')).toBe(
      'https://example.org/report'
    )
  })
})

describe('WhatsApp webhook parsing', () => {
  it('extracts inbound messages from a Meta-style webhook payload', () => {
    const messages = parseWhatsAppWebhookPayload({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: '436601234567', profile: { name: 'Atefeh Rahimi' } }],
                messages: [
                  {
                    id: 'wamid.123',
                    from: '436601234567',
                    type: 'text',
                    text: {
                      body: 'Please review this article https://example.org/new-study',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      providerMessageId: 'wamid.123',
      senderWhatsappId: '436601234567',
      senderName: 'Atefeh Rahimi',
      sourceUrl: 'https://example.org/new-study',
    })
  })
})
