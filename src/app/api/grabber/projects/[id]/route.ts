import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbReady()
  const { id } = await params
  await db.grabberProject.delete({ where: { id } })
  return json({ ok: true })
}
