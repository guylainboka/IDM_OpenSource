import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json } from '@/lib/api-helpers'
import { mapQueue } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET() {
  return withDb(async () => {
    const queues = await db.queue.findMany({
      orderBy: { priority: 'desc' },
      include: { _count: { select: { items: true } } },
    })
    return json(queues.map(mapQueue))
  })
}

export async function POST(req: NextRequest) {
  return withDb(async () => {
    const body = await req.json()
    const q = await db.queue.create({
      data: {
        name: body.name,
        maxConcurrent: Number(body.maxConcurrent ?? 2),
        connectionsPerDl: Number(body.connectionsPerDl ?? 8),
        speedLimit: Number(body.speedLimit ?? 0),
        priority: Number(body.priority ?? 0),
        retryMax: Number(body.retryMax ?? 5),
        endAction: body.endAction || 'none',
        startAt: body.startAt ? new Date(body.startAt) : null,
        stopAt: body.stopAt ? new Date(body.stopAt) : null,
      },
    })
    return json(mapQueue(q), 201)
  })
}
