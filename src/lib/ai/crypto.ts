import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

export class AiSecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiSecretError'
  }
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.AI_SETTINGS_ENCRYPTION_KEY

  if (!raw) {
    throw new AiSecretError('AI_SETTINGS_ENCRYPTION_KEY is required before an admin-entered Anthropic key can be stored')
  }

  const trimmed = raw.trim()

  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64')
    if (decoded.length === 32) return decoded
  } catch {
    // Fall through to hash derivation.
  }

  // Accept passphrase-style secrets for operational simplicity, but always derive
  // the fixed-length AES key through SHA-256 before use.
  return createHash('sha256').update(trimmed).digest()
}

export function encryptAiSecret(plainText: string): string {
  if (!plainText.trim()) throw new AiSecretError('Cannot encrypt an empty AI secret')

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, resolveEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [VERSION, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptAiSecret(cipherText: string): string {
  const [version, ivRaw, authTagRaw, encryptedRaw] = cipherText.split(':')
  if (version !== VERSION || !ivRaw || !authTagRaw || !encryptedRaw) {
    throw new AiSecretError('Unsupported or malformed encrypted AI secret')
  }

  const decipher = createDecipheriv(ALGORITHM, resolveEncryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export function secretLast4(secret: string): string {
  const trimmed = secret.trim()
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4)
}
