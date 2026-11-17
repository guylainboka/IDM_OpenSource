import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureDbReady()
  const projects = await db.grabberProject.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return json(
    projects.map((p) => ({
      id: p.id,
      url: p.url,
      depth: p.depth,
      maxPages: p.maxPages,
      status: p.status,
      config: p.config,
      createdAt:
        p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    })),
  )
}

export async function POST(req: NextRequest) {
  await ensureDbReady()
  const body = await req.json()
  const p = await db.grabberProject.create({
    data: {
      url: body.url,
      depth: Number(body.depth ?? 1),
      maxPages: Number(body.maxPages ?? 50),
      status: 'completed',
      config: JSON.stringify(body.config ?? {}),
    },
  })
  return json(
    {
      id: p.id,
      url: p.url,
      depth: p.depth,
      maxPages: p.maxPages,
      status: p.status,
      config: p.config,
      createdAt: p.createdAt.toISOString(),
    },
    201,
  )
}
