import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessCommsWorkspace } from '@/lib/comms-access'

function safeFileName(value: string | null): string {
  const cleaned = (value ?? 'conference-photo')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'conference-photo'
}

function allowedGuestUpload(rawUrl: string): URL | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    const candidate = new URL(rawUrl)
    const configured = new URL(supabaseUrl)
    const expectedPrefix = '/storage/v1/object/public/congress-guest-uploads/'
    if (candidate.protocol !== 'https:') return null
    if (candidate.origin !== configured.origin) return null
    if (!candidate.pathname.startsWith(expectedPrefix)) return null
    return candidate
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!canAccessCommsWorkspace(profile?.role)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const source = allowedGuestUpload(searchParams.get('url') ?? '')
  if (!source) {
    return NextResponse.json({ error: 'Unsupported media URL.' }, { status: 400 })
  }

  const response = await fetch(source, { cache: 'no-store' }).catch(() => null)
  if (!response?.ok) {
    return NextResponse.json({ error: 'Could not retrieve the photo.' }, { status: 502 })
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'The requested file is not an image.' }, { status: 415 })
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 52_428_800) {
    return NextResponse.json({ error: 'The image is too large to download.' }, { status: 413 })
  }

  const bytes = await response.arrayBuffer()
  const fileName = safeFileName(searchParams.get('name'))
  const encoded = encodeURIComponent(fileName)

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
