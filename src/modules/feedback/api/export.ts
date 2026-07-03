/**
 * feedback/api/export.ts — the Markdown export handler.
 *
 * The Next.js route (`src/app/app/admin/feedback/export/route.ts`) stays thin and
 * delegates here, so the export logic lives with the component it belongs to.
 */

import { NextRequest, NextResponse } from 'next/server'
import { loadFeedbackItems, requireFeedbackAdmin } from '@/modules/feedback/domain/repository'
import { shortUrl, type FeedbackItem } from '@/modules/feedback/domain/types'

/** Handle GET /app/admin/feedback/export — returns a Markdown attachment. */
export async function handleFeedbackExport(request: NextRequest): Promise<NextResponse> {
  const gate = await requireFeedbackAdmin()
  if (gate.reason === 'unauthenticated') return new NextResponse('Unauthorized', { status: 401 })
  if (gate.reason === 'forbidden') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') ?? 'all'
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const items = await loadFeedbackItems({ status: statusParam, ids })

  const filterLabel =
    ids.length > 0
      ? `${items.length} selected item${items.length === 1 ? '' : 's'}`
      : statusParam === 'all'
        ? 'All feedback'
        : `Status: ${statusParam}`

  const markdown = buildMarkdown(items, filterLabel)
  const filename = `feedback-export-${new Date().toISOString().slice(0, 10)}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function buildMarkdown(items: FeedbackItem[], filterLabel: string): string {
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  let md = `# Feedback Export — inspire2live Platform\n\n`
  md += `**Generated:** ${date}  \n`
  md += `**Filter:** ${filterLabel}  \n`
  md += `**Items:** ${items.length}  \n\n`
  md += `> Paste this file into a Claude Code session as context to review and fix the reported issues.\n\n`
  md += `---\n\n`

  if (items.length === 0) {
    md += `*No feedback items matched the selected filter.*\n`
    return md
  }

  for (const item of items) {
    const typeLabel = item.feedback_type.toUpperCase()
    const title = item.message.length > 80 ? item.message.slice(0, 80) + '…' : item.message

    const dateStr = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(item.created_at))

    md += `## [${typeLabel}] ${title}\n\n`
    md += `| Field | Value |\n`
    md += `|-------|-------|\n`
    md += `| **ID** | \`${item.id}\` |\n`
    md += `| **Page** | \`${shortUrl(item.page_url)}\` |\n`
    md += `| **Full URL** | ${item.page_url} |\n`
    if (item.page_title) md += `| **Page title** | ${item.page_title} |\n`
    md += `| **Submitted by** | ${item.user_name ?? 'Unknown'} (${item.user_role ?? '—'}) |\n`
    md += `| **Date** | ${dateStr} |\n`
    md += `| **Status** | ${item.status} |\n`

    if (item.element_text || item.element_path) {
      if (item.element_text) md += `| **Element text** | "${item.element_text}" |\n`
      if (item.element_path) md += `| **Element selector** | \`${item.element_path}\` |\n`
    }

    md += `\n**Reported issue:**\n\n`
    md += `> ${item.message.replace(/\n/g, '\n> ')}\n`

    if (item.admin_note) {
      md += `\n**Admin note:** ${item.admin_note}\n`
    }

    md += `\n---\n\n`
  }

  return md
}
