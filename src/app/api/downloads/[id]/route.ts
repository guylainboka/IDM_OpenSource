import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json, errorResponse } from '@/lib/api-helpers'
import { mapDownload } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    const dl = await db.download.findUnique({
      where: { id },
      include: { segments: true, errors: true },
    })
    if (!dl) return errorResponse('Téléchargement introuvable', 404)
    return json(mapDownload(dl))
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const data: any = {}
    if (body.category) data.category = body.category
    if (body.description !== undefined) data.description = body.description
    if (body.connections) data.connections = Number(body.connections)
    if (body.queueId !== undefined) data.queueId = body.queueId || null
    const updated = await db.download.update({ where: { id }, data })
    return json(mapDownload(updated))
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    await db.download.delete({ where: { id } })
    return json({ ok: true })
  })
}
