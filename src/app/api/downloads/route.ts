import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json } from '@/lib/api-helpers'
import { mapDownload } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withDb(async () => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const queueId = searchParams.get('queueId')
    const limit = Math.min(Number(searchParams.get('limit') || '500'), 2000)

    const where: any = {}
    if (status) {
      const statuses = status.split(',').filter(Boolean)
      if (statuses.length === 1) where.status = statuses[0]
      else if (statuses.length > 1) where.status = { in: statuses }
    }
    if (category && category !== 'all') where.category = category
    if (queueId) where.queueId = queueId
    if (search) {
      where.OR = [
        { filename: { contains: search } },
        { url: { contains: search } },
      ]
    }

    const downloads = await db.download.findMany({
      where,
      orderBy: { addedAt: 'desc' },
      take: limit,
      include: { segments: true },
    })
    return json(downloads.map(mapDownload))
  })
}

// Bulk delete completed/all
export async function DELETE(req: NextRequest) {
  return withDb(async () => {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope') || 'completed'
    const where: any =
      scope === 'all'
        ? {}
        : scope === 'completed'
          ? { status: 'completed' }
          : { status: { in: scope.split(',') } }
    const deleted = await db.download.deleteMany({ where })
    return json({ deleted: deleted.count })
  })
}
