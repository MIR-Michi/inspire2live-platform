'use server'

import { redirect } from 'next/navigation'
import { setViewAsRole, setViewAsUserType } from '@/lib/view-as'
import type { PlatformRole } from '@/lib/role-access'
import { normalizeUserType } from '@/lib/user-workspace'

export async function switchPerspective(formData: FormData) {
  const role = formData.get('role') as string | null
  const userType = normalizeUserType(formData.get('user_type') as string | null)
  if (role && role !== 'PlatformAdmin') {
    await setViewAsRole(role as PlatformRole)
  } else {
    await setViewAsRole(null)
  }
  await setViewAsUserType(userType === 'default' ? null : userType)
  redirect('/app/dashboard')
}
