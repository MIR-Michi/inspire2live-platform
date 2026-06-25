#!/usr/bin/env node
// WhatsApp webhook smoke test.
//
// Exercises the production (or any) `/api/comms/whatsapp` endpoint the same way
// Meta does, so you can confirm the *code path* works end-to-end — auth, parse,
// classify, store — without waiting on a real phone message or Meta's delivery
// config.
//
// Two checks:
//
//   verify  GET  hub.challenge handshake (proves WHATSAPP_VERIFY_TOKEN is set
//                and the deployment is live). Needs WHATSAPP_VERIFY_TOKEN.
//
//   send    POST a real Meta-shaped inbound `messages` payload, HMAC-signed
//                with your app secret. Lands a genuine intake item + an
//                "accepted" row in Webhook health. Needs WHATSAPP_APP_SECRET.
//
// Usage:
//   WHATSAPP_VERIFY_TOKEN=... node scripts/whatsapp-webhook-smoke.mjs verify
//   WHATSAPP_APP_SECRET=...   node scripts/whatsapp-webhook-smoke.mjs send "hello from smoke test"
//
// Override the target with WEBHOOK_URL=... (defaults to production).

import { createHmac } from 'node:crypto'

const DEFAULT_URL = 'https://inspire2live-platform.vercel.app/api/comms/whatsapp'
const url = process.env.WEBHOOK_URL || DEFAULT_URL

// A recognisable test sender so these items are easy to spot and clean up later.
const TEST_WA_ID = process.env.SMOKE_WA_ID || '15550000000'
const TEST_SENDER_NAME = process.env.SMOKE_SENDER_NAME || 'Smoke Test'

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

async function verify() {
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (!token) fail('Set WHATSAPP_VERIFY_TOKEN to run the verify handshake.')

  const challenge = `smoke-${Date.now()}`
  const target = `${url}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=${challenge}`

  console.log(`→ GET ${url} (hub.challenge=${challenge})`)
  const res = await fetch(target)
  const text = await res.text()

  if (res.status === 200 && text === challenge) {
    console.log(`\n✓ Verified. Endpoint echoed the challenge — WHATSAPP_VERIFY_TOKEN matches and the deploy is live.\n`)
    return
  }
  fail(`Handshake failed. status=${res.status} body=${JSON.stringify(text)}\n  ` +
    `403 → token mismatch or WHATSAPP_VERIFY_TOKEN unset on the server.`)
}

async function send(text) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    fail('Set WHATSAPP_APP_SECRET (the value from Meta → App Settings → Basic, also in Vercel) to sign the request.')
  }

  // Unique id each run so it is never deduplicated as a "duplicate".
  const messageId = `wamid.SMOKE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '3365644843603252',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '436706072307',
                phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '000000000000000',
              },
              contacts: [{ wa_id: TEST_WA_ID, profile: { name: TEST_SENDER_NAME } }],
              messages: [
                {
                  from: TEST_WA_ID,
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  })

  // Meta signs the raw request body with the app secret; the endpoint recomputes
  // and compares. Must sign the exact bytes we send.
  const signature = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`

  console.log(`→ POST ${url}`)
  console.log(`  message id: ${messageId}`)
  console.log(`  from: ${TEST_SENDER_NAME} <${TEST_WA_ID}>  text: ${JSON.stringify(text)}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body,
  })

  const json = await res.json().catch(() => null)
  console.log(`\n  status ${res.status}`)
  console.log(`  response ${JSON.stringify(json)}`)

  if (res.status === 200 && json?.ok && json?.accepted >= 1) {
    console.log(`\n✓ Accepted. A real intake item was created. Check:`)
    console.log(`  • Comms → WhatsApp inbox (sender "${TEST_SENDER_NAME}")`)
    console.log(`  • Comms → WhatsApp → Webhook health (Accepted count +1, "Last received" = just now)\n`)
    return
  }
  if (res.status === 401) {
    fail(`401 — signature rejected. WHATSAPP_APP_SECRET here does not match the server's. ` +
      `Pull the exact value from Vercel.`)
  }
  fail(`Unexpected response. The endpoint reached your code but did not accept the message.`)
}

const [, , cmd, ...rest] = process.argv
if (cmd === 'verify') {
  await verify()
} else if (cmd === 'send') {
  await send(rest.join(' ') || `[smoke-test] webhook check ${new Date().toISOString()}`)
} else {
  console.log(`Usage:
  WHATSAPP_VERIFY_TOKEN=... node scripts/whatsapp-webhook-smoke.mjs verify
  WHATSAPP_APP_SECRET=...   node scripts/whatsapp-webhook-smoke.mjs send "your message"

Optional: WEBHOOK_URL=... (default ${DEFAULT_URL})`)
  process.exit(cmd ? 1 : 0)
}
