import type { NextRequest } from 'next/server'
import { handleFeedbackExport } from '@/modules/feedback'

// Thin route — the export logic lives in the feedback module (api/export.ts).
export function GET(request: NextRequest) {
  return handleFeedbackExport(request)
}
