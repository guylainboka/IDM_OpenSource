import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureDbReady()
  const settings = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return json(map)
}

export async function PATCH(req: NextRequest) {
  await ensureDbReady()
  const body = (await req.json()) as Record<string, string>
  for (const [key, value] of Object.entries(body)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })
  }
  return json({ ok: true })
}
