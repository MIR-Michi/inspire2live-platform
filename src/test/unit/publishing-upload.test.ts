import { describe, expect, it } from 'vitest'
import { validateAdhocUpload } from '@/modules/publishing/domain/adhoc-source'

const MB = 1024 * 1024

describe('validateAdhocUpload', () => {
  it('accepts the allowed image types under the ceiling', () => {
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/png', size: 2 * MB }, 10)).toBeNull()
    expect(validateAdhocUpload({ name: 'a.jpg', type: 'image/jpeg', size: 2 * MB }, 10)).toBeNull()
    expect(validateAdhocUpload({ name: 'a.webp', type: 'image/webp', size: 2 * MB }, 10)).toBeNull()
  })

  it('rejects non-image MIME types (including spoofs)', () => {
    expect(validateAdhocUpload({ name: 'a.pdf', type: 'application/pdf', size: MB }, 10)).toMatch(/PNG, JPEG or WebP/)
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/svg+xml', size: MB }, 10)).toMatch(/PNG, JPEG or WebP/)
    expect(validateAdhocUpload({ name: 'a.png', type: 'text/html', size: MB }, 10)).toMatch(/PNG, JPEG or WebP/)
  })

  it('enforces the operator-tunable upload ceiling', () => {
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/png', size: 10 * MB + 1 }, 10)).toMatch(/10 MB/)
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/png', size: 10 * MB }, 10)).toBeNull()
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/png', size: 3 * MB }, 2)).toMatch(/2 MB/)
  })

  it('rejects an empty file', () => {
    expect(validateAdhocUpload({ name: 'a.png', type: 'image/png', size: 0 }, 10)).toMatch(/empty/)
  })
})
