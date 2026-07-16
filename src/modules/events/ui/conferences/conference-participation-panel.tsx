'use client'

import { useMemo, useState } from 'react'
import type { ConferenceAssignedContact } from '@/lib/comms-conferences'
import type { ConferenceGuestReport } from '@/lib/comms-conference-guest-reports'
import {
  buildConferenceParticipants,
  buildConferencePhotos,
  type ConferenceParticipant,
  type ConferencePhoto,
} from '@/modules/events/domain/conference-participation'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function attendanceTone(person: ConferenceParticipant): string {
  if (person.attendanceLabel === 'Registered') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (person.attendanceLabel === 'Intends to attend') {
    return 'border-orange-200 bg-orange-50 text-orange-700'
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-600'
}

function safeDownloadName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'conference-photo'
}

function downloadHref(photo: ConferencePhoto): string {
  if (!photo.downloadable) return photo.url
  const params = new URLSearchParams({
    url: photo.url,
    name: safeDownloadName(photo.fileName),
  })
  return `/api/conference-media/download?${params.toString()}`
}

function ParticipationContent({
  conferenceName,
  participants,
  photos,
}: {
  conferenceName: string
  participants: ConferenceParticipant[]
  photos: ConferencePhoto[]
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Attendance</p>
            <h2 className="text-base font-semibold text-neutral-900">People attending</h2>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
            {participants.length}
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-500">
            No attendees recorded yet. Assigned contacts and submitted guest responses will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {participants.map((person) => (
              <li key={person.key} className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{person.name}</p>
                    {person.email && <p className="truncate text-xs text-neutral-500">{person.email}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        {person.roleLabel}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${attendanceTone(person)}`}>
                        {person.attendanceLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Media</p>
            <h2 className="text-base font-semibold text-neutral-900">Conference photos</h2>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
            {photos.length}
          </span>
        </div>

        {photos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-sm text-neutral-500">
            Uploaded photos will appear here as previews.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <article key={photo.key} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${photo.fileName}`}
                  className="block aspect-square overflow-hidden bg-neutral-100"
                >
                  {/* External Supabase/public URLs are intentionally rendered with img;
                      their hosts are dynamic and should not require Next image config. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`${conferenceName} photo${photo.author ? ` uploaded by ${photo.author}` : ''}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-200 hover:scale-[1.03]"
                  />
                </a>
                <div className="space-y-2 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-neutral-800" title={photo.fileName}>{photo.fileName}</p>
                    {photo.author && <p className="truncate text-[10px] text-neutral-400">Uploaded by {photo.author}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-center text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Open
                    </a>
                    <a
                      href={downloadHref(photo)}
                      download={photo.downloadable ? undefined : safeDownloadName(photo.fileName)}
                      className="flex-1 rounded-lg bg-neutral-900 px-2 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-neutral-700"
                    >
                      Save
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function ConferenceParticipationPanel({
  conferenceName,
  assignedContacts,
  guestReports,
  teamPhotoUrls,
}: {
  conferenceName: string
  assignedContacts: ConferenceAssignedContact[]
  guestReports: ConferenceGuestReport[]
  teamPhotoUrls: string[]
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const participants = useMemo(
    () => buildConferenceParticipants(assignedContacts, guestReports),
    [assignedContacts, guestReports]
  )
  const photos = useMemo(
    () => buildConferencePhotos(teamPhotoUrls, guestReports),
    [teamPhotoUrls, guestReports]
  )

  return (
    <>
      <aside className="hidden xl:sticky xl:top-6 xl:block">
        <ParticipationContent conferenceName={conferenceName} participants={participants} photos={photos} />
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-neutral-700 xl:hidden"
        aria-label="Open attendee and photo overview"
      >
        <span aria-hidden="true">👥</span>
        {participants.length} attending
        {photos.length > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{photos.length} photos</span>}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6 xl:hidden" role="dialog" aria-modal="true" aria-label="Conference attendees and photos">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setMobileOpen(false)} aria-label="Close overview" />
          <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-neutral-50 p-4 shadow-2xl sm:max-w-xl sm:rounded-3xl">
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">{conferenceName}</p>
                <h2 className="text-lg font-semibold text-neutral-900">Attendance and media</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg text-neutral-500"
                aria-label="Close overview"
              >
                ×
              </button>
            </div>
            <ParticipationContent conferenceName={conferenceName} participants={participants} photos={photos} />
          </div>
        </div>
      )}
    </>
  )
}
