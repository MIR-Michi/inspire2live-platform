'use server'

import { redirect } from 'next/navigation'
import { setViewAsRole } from '@/lib/view-as'
import type { PlatformRole } from '@/lib/role-access'

export async function switchPerspective(formData: FormData) {
  const role = formData.get('role') as string | null
  if (role && role !== 'PlatformAdmin') {
    await setViewAsRole(role as PlatformRole)
  } else {
    await setViewAsRole(null)
  }
  redirect('/app/dashboard')
}
