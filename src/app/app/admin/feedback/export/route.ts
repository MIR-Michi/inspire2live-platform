import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { shortUrl, type FeedbackItem, type FeedbackStatus } from '@/lib/feedback'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'PlatformAdmin') return new NextResponse('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') ?? 'all'
  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const db = createAdminClient()
  let query = db.from('feedback_items').select('*').order('created_at', { ascending: false })

  if (ids.length > 0) {
    query = query.in('id', ids)
  } else if (statusParam !== 'all') {
    query = query.eq('status', statusParam as FeedbackStatus)
  }

  const { data } = await query
  const items = (data ?? []) as unknown as FeedbackItem[]

  const filterLabel = ids.length > 0
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
