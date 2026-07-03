const GRAPH_API_VERSION = 'v21.0'

export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string }

type GraphMessagesResponse = {
  messages?: Array<{ id?: string }>
  error?: { message?: string; type?: string; code?: number }
}

/**
 * Sends a plain-text WhatsApp message via the Meta Graph API.
 * Server-side only — never import this from a client component,
 * the access token must not reach the browser bundle.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp send is not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID).' }
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    })
  } catch (error) {
    console.error('[whatsapp-send] network error calling Graph API', error instanceof Error ? error.message : error)
    return { ok: false, error: 'Could not reach the WhatsApp Graph API.' }
  }

  let body: GraphMessagesResponse | null = null
  try {
    body = (await response.json()) as GraphMessagesResponse
  } catch {
    body = null
  }

  if (!response.ok || !body?.messages?.[0]?.id) {
    const metaError = body?.error?.message || `Graph API responded with status ${response.status}.`
    console.error('[whatsapp-send] Graph API error', { status: response.status, error: body?.error })
    return { ok: false, error: metaError }
  }

  console.info('[whatsapp-send] message sent', { messageId: body.messages[0].id, status: response.status })
  return { ok: true, messageId: body.messages[0].id }
}
