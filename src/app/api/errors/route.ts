import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await ensureDbReady()
  const { searchParams } = new URL(req.url)
  const downloadId = searchParams.get('downloadId')
  const limit = Math.min(Number(searchParams.get('limit') || '100'), 500)
  const errors = await db.errorLog.findMany({
    where: downloadId ? { downloadId } : {},
    orderBy: { timestamp: 'desc' },
    take: limit,
  })
  return json(
    errors.map((e) => ({
      id: e.id,
      downloadId: e.downloadId,
      code: e.code,
      message: e.message,
      timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp,
    })),
  )
}

export async function DELETE() {
  await ensureDbReady()
  const deleted = await db.errorLog.deleteMany({})
  return json({ deleted: deleted.count })
}
