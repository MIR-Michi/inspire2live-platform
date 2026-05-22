import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const THREAD_TYPE_META: Record<string, { color: string; label: string }> = {
  update:         { color: 'bg-blue-100 text-blue-700',    label: 'Update' },
  action_required:{ color: 'bg-red-100 text-red-700',      label: 'Action Required' },
  decision:       { color: 'bg-amber-100 text-amber-700',  label: 'Decision' },
  fyi:            { color: 'bg-neutral-100 text-neutral-600', label: 'FYI' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-orange-200 text-orange-800',
  'bg-blue-200 text-blue-800',
  'bg-emerald-200 text-emerald-800',
  'bg-purple-200 text-purple-800',
  'bg-amber-200 text-amber-800',
]
function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export default async function CommunicationPage({ params }: { params: Promise<{ id: string }> }) {
  // Keep param parsing for future DB integration; avoid lint unused-vars.
  const { id } = await params
  void id
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const emails = DEMO_EMAIL_THREADS
  const chat = DEMO_TEAM_CHAT
  const unreadCount = emails.filter(e => e.unread).length

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Communication</h2>
          <p className="text-sm text-neutral-500">Team email feed & chat</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          📬 Email integration planned — showing representative content
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Email Feed ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Email Feed</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {unreadCount} unread
              </span>
            )}
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <div className="space-y-2">
            {emails.map(em => {
              const typeMeta = THREAD_TYPE_META[em.thread_type] ?? THREAD_TYPE_META.fyi
              return (
                <div
                  key={em.id}
                  className={`rounded-xl border p-4 shadow-sm transition-colors ${em.unread ? 'border-blue-200 bg-blue-50' : 'border-neutral-200 bg-white'}`}
                >
                  {/* Subject row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${em.unread ? 'text-blue-900' : 'text-neutral-900'}`}>
                      {em.unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />}
                      {em.subject}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                      <span className="text-xs text-neutral-400">{timeAgo(em.date)}</span>
                    </div>
                  </div>

                  {/* From / to */}
                  <p className="mt-1 text-xs text-neutral-500">
                    <span className="font-medium">{em.from.name}</span>
                    {em.to.length > 0 && <> → {em.to.map(t => t.name).join(', ')}</>}
                    {em.reply_count > 0 && <span className="ml-2 text-neutral-400">{em.reply_count} replies</span>}
                  </p>

                  {/* Preview */}
                  <p className="mt-1.5 text-xs text-neutral-600 line-clamp-2">{em.preview}</p>

                  {/* Labels */}
                  {em.labels && em.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {em.labels.map(l => (
                        <span key={l} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{l}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Compose placeholder */}
          <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium text-neutral-500">✉️ Compose email</p>
            <div className="mt-2 h-8 rounded-lg border border-neutral-200 bg-white px-3 flex items-center">
              <span className="text-xs text-neutral-300">To: team members...</span>
            </div>
            <div className="mt-1.5 h-16 rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="text-xs text-neutral-300">Message...</span>
            </div>
            <div className="mt-2 flex justify-end">
              <div className="rounded-lg bg-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-500 cursor-not-allowed">
                Send (coming soon)
              </div>
            </div>
          </div>
        </section>

        {/* ── Team Chat ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Team Chat</h3>
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Preview — non-functional
            </span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            {/* Chat messages */}
            <div className="space-y-4 p-4 max-h-120 overflow-y-auto">
              {chat.map(msg => (
                <div key={msg.id} className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(msg.author)}`}>
                    {initials(msg.author)}
                  </div>
                  {/* Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-neutral-800">{msg.author}</span>
                      <span className="text-[10px] text-neutral-400">{timeAgo(msg.timestamp)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-neutral-700 leading-relaxed">{msg.message}</p>
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.reactions.map((r, i) => (
                          <span key={i} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs">
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat composer placeholder */}
            <div className="border-t border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-300">
                  Type a message... (coming soon)
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-400 cursor-not-allowed">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </div>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-neutral-400">
                Real-time team chat integration planned
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
