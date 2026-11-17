import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { json } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureDbReady()
  const all = await db.download.findMany({
    select: {
      status: true,
      size: true,
      downloaded: true,
      category: true,
      speed: true,
    },
  })
  const counts: Record<string, number> = {}
  let totalSize = 0n
  let totalDownloaded = 0n
  let activeSpeed = 0
  const byCategory: Record<string, number> = {}
  for (const d of all) {
    counts[d.status] = (counts[d.status] || 0) + 1
    totalSize += d.size
    totalDownloaded += d.downloaded
    if (d.status === 'downloading') activeSpeed += d.speed
    byCategory[d.category] = (byCategory[d.category] || 0) + 1
  }
  return json({
    counts,
    totalDownloads: all.length,
    totalSize: totalSize.toString(),
    totalDownloaded: totalDownloaded.toString(),
    activeSpeed,
    byCategory,
    activeCount: counts['downloading'] || 0,
    queuedCount: counts['queued'] || 0,
    completedCount: counts['completed'] || 0,
    failedCount: counts['failed'] || 0,
    pausedCount: counts['paused'] || 0,
  })
}
