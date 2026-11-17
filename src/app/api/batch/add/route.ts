import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json, errorResponse } from '@/lib/api-helpers'
import { classifyByExtension } from '@/lib/types'

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const b = u.pathname.split('/').filter(Boolean).pop()
    return b ? decodeURIComponent(b) : 'download.bin'
  } catch {
    return 'download.bin'
  }
}

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'download.bin'
}

// Insert multiple URLs as pending downloads (engine picks them up via the
// orphan-pending check). Skips URLs already present (duplicate detection).
export async function POST(req: NextRequest) {
  await ensureDbReady()
  const body = await req.json().catch(() => ({}))
  const urls: string[] = Array.isArray(body.urls) ? body.urls : []
  const queueId = body.queueId || null
  const connections = Number(body.connections ?? 8)

  if (urls.length === 0) return errorResponse('Aucune URL', 400)
  if (urls.length > 1000) return errorResponse('Trop d’URLs (>1000)', 400)

  const created: string[] = []
  const skipped: string[] = []

  for (const raw of urls) {
    const url = String(raw).trim()
    if (!/^https?:\/\//i.test(url)) {
      skipped.push(url)
      continue
    }
    const existing = await db.download.findFirst({ where: { url } })
    if (existing) {
      skipped.push(url)
      continue
    }
    const filename = safeFilename(filenameFromUrl(url))
    const category = classifyByExtension(filename)
    const dl = await db.download.create({
      data: {
        url,
        filename,
        category,
        connections,
        queueId,
        status: 'pending',
      },
    })
    if (queueId) {
      const max = await db.queueItem.aggregate({
        where: { queueId },
        _max: { position: true },
      })
      await db.queueItem.create({
        data: {
          queueId,
          downloadId: dl.id,
          position: (max._max.position ?? -1) + 1,
        },
      })
    }
    created.push(dl.id)
  }

  return json({ created: created.length, skipped: skipped.length, createdIds: created })
}
