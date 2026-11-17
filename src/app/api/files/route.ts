import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'
import { stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await ensureDbReady()
  const { searchParams } = new URL(req.url)
  const onlyCompleted = searchParams.get('completed') !== 'false'
  const downloads = await db.download.findMany({
    where: onlyCompleted ? { status: 'completed' } : {},
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      filename: true,
      category: true,
      size: true,
      outputPath: true,
      completedAt: true,
      mimeType: true,
    },
  })
  const result = []
  for (const d of downloads) {
    const size = Number(d.size)
    let exists = false
    if (d.outputPath) {
      try {
        const s = await stat(d.outputPath)
        exists = true
        void s
      } catch {
        exists = false
      }
    }
    result.push({
      id: d.id,
      filename: d.filename,
      category: d.category,
      size: size,
      outputPath: d.outputPath,
      completedAt:
        d.completedAt instanceof Date ? d.completedAt.toISOString() : d.completedAt,
      mimeType: d.mimeType,
      exists,
      base: d.outputPath ? basename(d.outputPath) : d.filename,
    })
  }
  return json(result)
}
