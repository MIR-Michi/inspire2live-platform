'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { submitManualIntake, type CommsFormState } from '@/app/app/comms/intake/actions'
import { CONTENT_TYPE_META } from '@/lib/comms-workflow'

const INITIAL_STATE: CommsFormState = { ok: false }

export function ManualIntakeForm() {
  const [state, formAction, pending] = useActionState(submitManualIntake, INITIAL_STATE)

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">
          Sprint 02 capture
        </p>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-neutral-900">New intake item</h2>
          <p className="max-w-3xl text-sm text-neutral-600">
            Capture the publishable signal from WhatsApp without copying the whole thread. The
            queue stays useful when each entry includes the sender, the message summary, and the
            clearest route for the comms team.
          </p>
        </div>
      </div>

      <form action={formAction} className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Sender name</span>
            <input
              name="sender_name"
              required
              placeholder="e.g. Sophie van der Berg, Peter Kapitein, Stephen Rowley"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Message content or summary</span>
            <textarea
              name="raw_content"
              rows={8}
              required
              placeholder="Summarize the post, caption, or ask in the clearest possible way."
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>

        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Content type</span>
            <select
              name="content_type"
              required
              defaultValue="article_share"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {Object.entries(CONTENT_TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Source URL</span>
            <input
              name="source_url"
              type="url"
              placeholder="https://example.org/article or LinkedIn post"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-800">Attached media reference</span>
            <input
              name="attached_media_ref"
              placeholder="SharePoint folder, Google Drive, WhatsApp media note, etc."
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            <p className="font-semibold">Intermediate quality checks</p>
            <ul className="mt-2 space-y-1 text-orange-800">
              <li>Sender and content type match the message you are triaging.</li>
              <li>Summary is specific enough for routing without reopening WhatsApp.</li>
              <li>Any source or media reference needed later is preserved here.</li>
            </ul>
          </div>
        </div>

        {state.error && (
          <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {state.ok && state.message && (
          <div className="lg:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.message}
          </div>
        )}

        <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-2">
          <Link
            href="/app/comms/intake"
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Back to queue
          </Link>

          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {pending ? 'Saving…' : 'Capture intake item'}
          </button>
        </div>
      </form>
    </section>
  )
}
