import { describe, expect, it, vi } from 'vitest'
import { deflateRawSync } from 'node:zlib'

vi.mock('server-only', () => ({}))

import {
  extractTranscriptText,
  transcriptFormatFromFilename,
  TranscriptExtractionError,
} from '@/lib/ai/transcript-extract'

function buf(text: string) {
  return Buffer.from(text, 'utf8')
}

/** Build a minimal valid .docx (ZIP with a single deflated word/document.xml). */
function buildDocx(documentXml: string, options: { useDataDescriptor?: boolean } = {}): Buffer {
  const name = Buffer.from('word/document.xml', 'utf8')
  const content = Buffer.from(documentXml, 'utf8')
  const compressed = deflateRawSync(content)
  const generalPurposeFlag = options.useDataDescriptor ? 0x08 : 0

  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4) // version needed
  localHeader.writeUInt16LE(generalPurposeFlag, 6)
  localHeader.writeUInt16LE(8, 8) // deflate
  localHeader.writeUInt32LE(0, 14) // crc (ignored by reader)
  localHeader.writeUInt32LE(options.useDataDescriptor ? 0 : compressed.length, 18)
  localHeader.writeUInt32LE(options.useDataDescriptor ? 0 : content.length, 22)
  localHeader.writeUInt16LE(name.length, 26)
  localHeader.writeUInt16LE(0, 28)

  const descriptor = Buffer.alloc(options.useDataDescriptor ? 16 : 0)
  if (options.useDataDescriptor) {
    descriptor.writeUInt32LE(0x08074b50, 0)
    descriptor.writeUInt32LE(0, 4) // crc (ignored by reader)
    descriptor.writeUInt32LE(compressed.length, 8)
    descriptor.writeUInt32LE(content.length, 12)
  }

  const localRecord = Buffer.concat([localHeader, name, compressed, descriptor])

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(generalPurposeFlag, 8)
  central.writeUInt16LE(8, 10) // deflate
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(0, 42) // local header offset
  const centralRecord = Buffer.concat([central, name])

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8) // entries on disk
  eocd.writeUInt16LE(1, 10) // total entries
  eocd.writeUInt32LE(centralRecord.length, 12)
  eocd.writeUInt32LE(localRecord.length, 16) // central dir offset

  return Buffer.concat([localRecord, centralRecord, eocd])
}

describe('transcriptFormatFromFilename', () => {
  it('maps known extensions', () => {
    expect(transcriptFormatFromFilename('notes.txt')).toBe('txt')
    expect(transcriptFormatFromFilename('Meeting.VTT')).toBe('vtt')
    expect(transcriptFormatFromFilename('call.srt')).toBe('srt')
    expect(transcriptFormatFromFilename('minutes.docx')).toBe('docx')
  })

  it('rejects unsupported and missing extensions', () => {
    expect(transcriptFormatFromFilename('recording.mp4')).toBeNull()
    expect(transcriptFormatFromFilename('noextension')).toBeNull()
  })
})

describe('extractTranscriptText', () => {
  it('extracts plain txt directly', () => {
    const result = extractTranscriptText(buf('Alice: Hello team\nBob: Hi Alice'), 'txt')
    expect(result.format).toBe('txt')
    expect(result.text).toContain('Alice: Hello team')
    expect(result.text).toContain('Bob: Hi Alice')
  })

  it('strips VTT header, timestamps and tags but keeps speaker text', () => {
    const vtt = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:04.000',
      '<v Alice>Welcome everyone</v>',
      '',
      '2',
      '00:00:04.000 --> 00:00:07.000 align:start',
      'Bob: We decided to ship Friday',
    ].join('\n')
    const result = extractTranscriptText(buf(vtt), 'vtt')
    expect(result.text).not.toContain('WEBVTT')
    expect(result.text).not.toContain('-->')
    expect(result.text).toContain('Alice: Welcome everyone')
    expect(result.text).toContain('Bob: We decided to ship Friday')
  })

  it('strips SRT indices and timestamps', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:04,000', 'Carol: Kickoff notes', '', '2', '00:00:05,000 --> 00:00:08,000', 'Dan: Agreed'].join('\n')
    const result = extractTranscriptText(buf(srt), 'srt')
    expect(result.text).not.toMatch(/-->/)
    expect(result.text).not.toMatch(/^1$/m)
    expect(result.text).toContain('Carol: Kickoff notes')
    expect(result.text).toContain('Dan: Agreed')
  })

  it('extracts paragraph text from a docx body', () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body>' +
      '<w:p><w:r><w:t>Alice: Opening remarks</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Bob: We &amp; the team agreed</w:t></w:r></w:p>' +
      '</w:body></w:document>'
    const result = extractTranscriptText(buildDocx(xml), 'docx')
    expect(result.format).toBe('docx')
    expect(result.text).toContain('Alice: Opening remarks')
    expect(result.text).toContain('Bob: We & the team agreed')
  })

  it('extracts docx entries that store sizes in a data descriptor', () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body>' +
      '<w:p><w:r><w:t>Campus lead: Welcome to the World Campus update</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Coordinator: Follow up with the Dutch team</w:t></w:r></w:p>' +
      '</w:body></w:document>'
    const result = extractTranscriptText(buildDocx(xml, { useDataDescriptor: true }), 'docx')
    expect(result.format).toBe('docx')
    expect(result.text).toContain('Campus lead: Welcome to the World Campus update')
    expect(result.text).toContain('Coordinator: Follow up with the Dutch team')
  })

  it('throws on empty extracted text', () => {
    expect(() => extractTranscriptText(buf('   \n  '), 'txt')).toThrow(TranscriptExtractionError)
  })

  it('throws on a non-docx buffer', () => {
    expect(() => extractTranscriptText(buf('not a zip'), 'docx')).toThrow(TranscriptExtractionError)
  })
})
