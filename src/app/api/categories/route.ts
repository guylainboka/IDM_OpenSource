import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json } from '@/lib/api-helpers'
import { mapCategory } from '@/lib/mappers'

export const dynamic = 'force-dynamic'

export async function GET() {
  return withDb(async () => {
    const cats = await db.category.findMany({ orderBy: { position: 'asc' } })
    return json(cats.map(mapCategory))
  })
}

export async function POST(req: NextRequest) {
  return withDb(async () => {
    const body = await req.json()
    const max = await db.category.aggregate({ _max: { position: true } })
    const cat = await db.category.create({
      data: {
        name: body.name,
        color: body.color || '#64748b',
        extensions: Array.isArray(body.extensions)
          ? body.extensions.join(',')
          : body.extensions || '',
        destination: body.destination || null,
        namingRule: body.namingRule || null,
        position: (max._max.position ?? -1) + 1,
      },
    })
    return json(mapCategory(cat), 201)
  })
}
