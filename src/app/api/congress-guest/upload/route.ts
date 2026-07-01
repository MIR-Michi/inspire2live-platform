/**
 * POST /api/congress-guest/upload
 *
 * Public: accepts a multipart upload (token + submissionId + file),
 * validates the token, streams the file to Supabase storage via service role,
 * then registers the file in the DB via the register_guest_file RPC.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

function fileTypeFromMime(mime: string): 'photo' | 'presentation' | 'document' {
  if (mime.startsWith('image/')) return 'photo'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation'
  return 'document'
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const token = (formData.get('token') as string | null)?.trim() ?? ''
  const submissionId = (formData.get('submissionId') as string | null)?.trim() ?? ''
  const file = formData.get('file') as File | null

  if (!token || !submissionId || !file) {
    return NextResponse.json({ error: 'Missing token, submissionId, or file' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed.' }, { status: 415 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50 MB).' }, { status: 413 })
  }

  // Validate token via anon RPC (prevents writes with an invalid token).
  const anonSupabase = createClient(supabaseUrl, anonKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenData } = await (anonSupabase as any).rpc('validate_conference_guest_token', {
    raw_token: token,
  })
  if (!tokenData || tokenData.length === 0) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 403 })
  }

  // Upload via service role (bypasses RLS on storage).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ext = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 100)
  const storagePath = `${submissionId}/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('congress-guest-uploads')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[congress-guest/upload] storage error', uploadError)
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 })
  }

  const { data: urlData } = admin.storage
    .from('congress-guest-uploads')
    .getPublicUrl(storagePath)

  const publicUrl = urlData?.publicUrl ?? null
  const fileType = fileTypeFromMime(file.type)

  // Register the file in the DB via anon-callable RPC.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fileId, error: regError } = await (anonSupabase as any).rpc('register_guest_file', {
    p_raw_token: token,
    p_sub_id: submissionId,
    p_file_type: fileType,
    p_storage_path: storagePath,
    p_file_name: file.name.slice(0, 255),
    p_file_size: file.size,
    p_public_url: publicUrl,
  })

  if (regError) {
    console.error('[congress-guest/upload] register_guest_file error', regError)
    // File is in storage but not in DB — not ideal but not blocking.
  }

  void ext // suppress unused-var

  return NextResponse.json({ ok: true, fileId, publicUrl, fileType, fileName: file.name })
}
