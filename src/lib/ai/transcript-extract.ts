import 'server-only'

import { inflateRawSync } from 'node:zlib'

export type TranscriptFormat = 'txt' | 'vtt' | 'srt' | 'docx'

export type ExtractedTranscript = {
  format: TranscriptFormat
  text: string
}

export class TranscriptExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptExtractionError'
  }
}

const FORMAT_BY_EXTENSION: Record<string, TranscriptFormat> = {
  txt: 'txt',
  text: 'txt',
  vtt: 'vtt',
  srt: 'srt',
  docx: 'docx',
}

/** Resolve a transcript format from a filename extension. */
export function transcriptFormatFromFilename(filename: string): TranscriptFormat | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim())
  if (!match) return null
  return FORMAT_BY_EXTENSION[match[1].toLowerCase()] ?? null
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TIMESTAMP_LINE = /^[\d:.,]+\s*-->\s*[\d:.,]+/
const VTT_HEADER = /^WEBVTT/
const VTT_BLOCK_NOTE = /^(NOTE|STYLE|REGION)\b/
const CUE_SETTING = /\b(align|position|size|line|vertical):[^\s]+/g

/**
 * VTT/SRT share a cue structure: an optional numeric index, a timestamp line
 * with `-->`, then one or more text lines (which may carry a `Speaker:` prefix
 * or inline `<v Speaker>` voice tags). We keep the spoken text and speaker
 * labels and drop indices, timestamps, and styling so the model sees a clean,
 * speaker-attributed transcript.
 */
function extractCues(raw: string, format: 'vtt' | 'srt'): string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    if (format === 'vtt' && (VTT_HEADER.test(line) || VTT_BLOCK_NOTE.test(line))) continue
    if (TIMESTAMP_LINE.test(line)) continue
    // A standalone integer line is a cue index (SRT always, VTT optionally).
    if (/^\d+$/.test(line)) continue

    let text = line.replace(CUE_SETTING, '').trim()
    // VTT voice spans: <v Speaker>text</v> → "Speaker: text".
    text = text.replace(/<v(?:\.[^\s>]+)?\s+([^>]+)>/g, '$1: ')
    // Strip any remaining inline tags (<i>, <b>, <00:00:01.000>, </v>, …).
    text = text.replace(/<\/?[^>]+>/g, '').trim()
    if (text) out.push(text)
  }

  return normalizeWhitespace(out.join('\n'))
}

// -- Minimal docx (ZIP) text extraction ----------------------
// A .docx is a ZIP archive; the document body lives in word/document.xml.
// We locate that entry via the ZIP central directory, inflate it, and strip
// the WordprocessingML markup down to paragraph-separated plain text. This
// avoids a third-party dependency for a single, well-specified file.

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50

type ZipEntry = { name: string; compressionMethod: number; compressedSize: number; localHeaderOffset: number }

function findEndOfCentralDirectory(buffer: Buffer): number {
  // EOCD is at the end; scan backwards (comment field is usually empty).
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i
  }
  return -1
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer)
  if (eocd < 0) throw new TranscriptExtractionError('Not a valid .docx file (no ZIP end-of-central-directory record).')

  const entryCount = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) break
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const o = entry.localHeaderOffset
  if (buffer.readUInt32LE(o) !== 0x04034b50) {
    throw new TranscriptExtractionError('Corrupt .docx file (bad local file header).')
  }
  const nameLength = buffer.readUInt16LE(o + 26)
  const extraLength = buffer.readUInt16LE(o + 28)
  const dataStart = o + 30 + nameLength + extraLength
  const dataEnd = dataStart + entry.compressedSize
  if (dataEnd > buffer.length) {
    throw new TranscriptExtractionError('Corrupt .docx file (entry data exceeds archive size).')
  }
  const data = buffer.subarray(dataStart, dataEnd)

  if (entry.compressionMethod === 0) return Buffer.from(data) // stored
  if (entry.compressionMethod === 8) return inflateRawSync(data) // deflate
  throw new TranscriptExtractionError(`Unsupported .docx compression method: ${entry.compressionMethod}`)
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

function documentXmlToText(xml: string): string {
  // Paragraph and line breaks become newlines; tabs become tabs; everything
  // inside <w:t> runs is the visible text. Order is preserved by walking the
  // markup with a single regex over the structural tags and text runs.
  const tokens = xml.match(/<w:p\b[^>]*\/?>|<\/w:p>|<w:br\b[^>]*\/?>|<w:tab\b[^>]*\/?>|<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? []
  let out = ''
  for (const token of tokens) {
    if (token.startsWith('</w:p>') || token.startsWith('<w:p')) {
      out += '\n'
    } else if (token.startsWith('<w:br')) {
      out += '\n'
    } else if (token.startsWith('<w:tab')) {
      out += '\t'
    } else {
      const inner = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/.exec(token)
      if (inner) out += decodeXmlEntities(inner[1])
    }
  }
  return normalizeWhitespace(out)
}

function extractDocx(buffer: Buffer): string {
  const entries = readCentralDirectory(buffer)
  const entry = entries.find((e) => e.name === 'word/document.xml')
  if (!entry) throw new TranscriptExtractionError('Not a valid .docx file (missing word/document.xml).')
  const xml = readZipEntry(buffer, entry).toString('utf8')
  return documentXmlToText(xml)
}

/**
 * Extract plain transcript text from an uploaded file buffer.
 *
 * - txt: decoded directly
 * - vtt / srt: cues parsed, timestamps and indices removed, speakers kept
 * - docx: WordprocessingML body extracted to paragraph-separated text
 */
export function extractTranscriptText(buffer: Buffer, format: TranscriptFormat): ExtractedTranscript {
  let text: string

  switch (format) {
    case 'txt':
      text = normalizeWhitespace(buffer.toString('utf8'))
      break
    case 'vtt':
      text = extractCues(buffer.toString('utf8'), 'vtt')
      break
    case 'srt':
      text = extractCues(buffer.toString('utf8'), 'srt')
      break
    case 'docx':
      text = extractDocx(buffer)
      break
    default:
      throw new TranscriptExtractionError(`Unsupported transcript format: ${format}`)
  }

  if (!text.trim()) {
    throw new TranscriptExtractionError('No readable text could be extracted from the transcript.')
  }

  return { format, text }
}
