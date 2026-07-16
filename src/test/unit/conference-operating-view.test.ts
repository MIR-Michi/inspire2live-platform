import { describe, expect, it } from 'vitest'

import { buildOperatingView, type MergeGuestReport } from '@/modules/events/domain/conference-operating-view'

function report(over: Partial<MergeGuestReport> = {}): MergeGuestReport {
  return { submitterName: 'Jane Doe', summary: null, comments: [], files: [], ...over }
}

describe('buildOperatingView', () => {
  it('merges team and guest photos, deduped by url, tagged by source', () => {
    const view = buildOperatingView(
      ['https://a.com/1.jpg', 'https://shared.com/x.jpg'],
      [
        report({
          submitterName: 'Guest A',
          files: [
            { id: 'f1', fileType: 'photo', fileName: 'p.jpg', publicUrl: 'https://g.com/2.jpg' },
            { id: 'f2', fileType: 'photo', fileName: 'dup.jpg', publicUrl: 'https://shared.com/x.jpg' },
          ],
        }),
      ]
    )
    expect(view.photos).toEqual([
      { url: 'https://a.com/1.jpg', source: 'team', label: null },
      { url: 'https://shared.com/x.jpg', source: 'team', label: null },
      { url: 'https://g.com/2.jpg', source: 'guest', label: 'Guest A' },
    ])
    expect(view.hasGuestPhotos).toBe(true)
  })

  it('collects guest summaries and comments', () => {
    const view = buildOperatingView(
      [],
      [
        report({
          submitterName: 'Guest B',
          summary: 'Great sessions on immuno-oncology.',
          comments: [{ id: 'c1', content: 'Met Dr Smith', createdAt: '2026-02-11' }],
        }),
      ]
    )
    expect(view.hasGuestSummary).toBe(true)
    expect(view.guestSummaries[0]).toMatchObject({ author: 'Guest B', content: 'Great sessions on immuno-oncology.' })
    expect(view.guestComments).toEqual([{ id: 'c1', author: 'Guest B', content: 'Met Dr Smith', createdAt: '2026-02-11' }])
  })

  it('separates guest presentations from photos', () => {
    const view = buildOperatingView(
      [],
      [
        report({
          files: [
            { id: 'd1', fileType: 'presentation', fileName: 'slides.pdf', publicUrl: 'https://g.com/slides.pdf' },
            { id: 'd2', fileType: 'document', fileName: 'notes.docx', publicUrl: null },
          ],
        }),
      ]
    )
    expect(view.guestPresentations).toEqual([{ id: 'd1', author: 'Jane Doe', fileName: 'slides.pdf', url: 'https://g.com/slides.pdf' }])
    expect(view.hasGuestPhotos).toBe(false)
    expect(view.photos).toEqual([])
  })

  it('ignores empty summaries and blank urls', () => {
    const view = buildOperatingView(
      ['', '  '],
      [report({ summary: '   ', files: [{ id: 'f', fileType: 'photo', fileName: 'x', publicUrl: null }] })]
    )
    expect(view.photos).toEqual([])
    expect(view.hasGuestSummary).toBe(false)
    // a photo with no public url still flags that guests uploaded photos
    expect(view.hasGuestPhotos).toBe(true)
  })
})
