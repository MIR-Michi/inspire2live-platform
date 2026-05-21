import { describe, expect, it } from 'vitest'
import { buildRecoveryTitle, parseTagInput } from '@/lib/comms-media'

describe('comms-media helpers', () => {
  it('deduplicates and trims tag input', () => {
    expect(parseTagInput(' congress, photos, congress ,  follow-up ')).toEqual([
      'congress',
      'photos',
      'follow-up',
    ])
  })

  it('builds a recovery title from the first sentence when available', () => {
    expect(
      buildRecoveryTitle(
        'Congress photos are still missing from the shared folder. Jeff might have them in Teams.',
        'Maryana Sukhorukova'
      )
    ).toBe('Congress photos are still missing from the shared folder')
  })
})
