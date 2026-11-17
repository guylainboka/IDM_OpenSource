import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json, errorResponse } from '@/lib/api-helpers'
import { mapQueue } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const data: any = {}
    if (body.name) data.name = body.name
    if (body.maxConcurrent !== undefined) data.maxConcurrent = Number(body.maxConcurrent)
    if (body.connectionsPerDl !== undefined) data.connectionsPerDl = Number(body.connectionsPerDl)
    if (body.speedLimit !== undefined) data.speedLimit = Number(body.speedLimit)
    if (body.priority !== undefined) data.priority = Number(body.priority)
    if (body.retryMax !== undefined) data.retryMax = Number(body.retryMax)
    if (body.endAction !== undefined) data.endAction = body.endAction
    if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null
    if (body.stopAt !== undefined) data.stopAt = body.stopAt ? new Date(body.stopAt) : null
    const q = await db.queue.update({ where: { id }, data })
    return json(mapQueue(q))
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    await db.queue.delete({ where: { id } })
    return json({ ok: true })
  })
}
