import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json, errorResponse } from '@/lib/api-helpers'
import { mapDownload } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

// List downloads in a queue
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    const items = await db.queueItem.findMany({
      where: { queueId: id },
      orderBy: { position: 'asc' },
      include: { download: { include: { segments: true } } },
    })
    return json(items.map((i) => mapDownload(i.download)))
  })
}

// Add a download to a queue
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    const body = await req.json()
    const downloadId = body.downloadId
    const exists = await db.queueItem.findUnique({
      where: { queueId_downloadId: { queueId: id, downloadId } },
    })
    if (exists) return errorResponse('Déjà présent dans la file', 400)
    const max = await db.queueItem.aggregate({
      where: { queueId: id },
      _max: { position: true },
    })
    await db.queueItem.create({
      data: {
        queueId: id,
        downloadId,
        position: (max._max.position ?? -1) + 1,
      },
    })
    await db.download.update({
      where: { id: downloadId },
      data: { queueId: id },
    })
    return json({ ok: true })
  })
}
