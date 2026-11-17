import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withDb, json, errorResponse } from '@/lib/api-helpers'
import { mapCategory } from '@/lib/mappers'

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
    if (body.color) data.color = body.color
    if (body.extensions !== undefined) {
      data.extensions = Array.isArray(body.extensions)
        ? body.extensions.join(',')
        : body.extensions || ''
    }
    if (body.destination !== undefined) data.destination = body.destination || null
    if (body.namingRule !== undefined) data.namingRule = body.namingRule || null
    if (body.position !== undefined) data.position = Number(body.position)
    const cat = await db.category.update({ where: { id }, data })
    return json(mapCategory(cat))
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDb(async () => {
    const { id } = await params
    // prevent deleting the default "Autres" category
    const cat = await db.category.findUnique({ where: { id } })
    if (cat?.name === 'Autres') return errorResponse('Catégorie protégée', 400)
    await db.category.delete({ where: { id } })
    return json({ ok: true })
  })
}
