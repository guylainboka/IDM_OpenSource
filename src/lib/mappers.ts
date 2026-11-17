import type { DownloadDTO, SegmentDTO, CategoryDTO, QueueDTO } from './types'

export function mapDownload(dl: any): DownloadDTO {
  const size = Number(dl.size)
  const downloaded = Number(dl.downloaded)
  return {
    id: dl.id,
    url: dl.url,
    finalUrl: dl.finalUrl,
    filename: dl.filename,
    category: dl.category,
    mimeType: dl.mimeType,
    size: dl.size.toString(),
    downloaded: dl.downloaded.toString(),
    status: dl.status as DownloadDTO['status'],
    speed: dl.speed,
    avgSpeed: dl.avgSpeed,
    eta: dl.eta,
    connections: dl.connections,
    supportsRange: dl.supportsRange,
    etag: dl.etag,
    lastModified: dl.lastModified,
    server: dl.server,
    outputPath: dl.outputPath,
    queueId: dl.queueId,
    error: dl.error,
    description: dl.description,
    segmentsTotal: dl.segmentsTotal,
    addedAt: dl.addedAt instanceof Date ? dl.addedAt.toISOString() : dl.addedAt,
    startedAt:
      dl.startedAt instanceof Date ? dl.startedAt.toISOString() : dl.startedAt || null,
    completedAt:
      dl.completedAt instanceof Date
        ? dl.completedAt.toISOString()
        : dl.completedAt || null,
    lastTryAt:
      dl.lastTryAt instanceof Date ? dl.lastTryAt.toISOString() : dl.lastTryAt || null,
    retries: dl.retries,
    progress: size > 0 ? downloaded / size : 0,
    segments: dl.segments?.map(mapSegment),
  }
}

export function mapSegment(s: any): SegmentDTO {
  return {
    id: s.id,
    index: s.index,
    startByte: s.startByte.toString(),
    endByte: s.endByte.toString(),
    downloadedBytes: s.downloadedBytes.toString(),
    status: s.status as SegmentDTO['status'],
    workerId: s.workerId,
  }
}

export function mapCategory(c: any): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    extensions: c.extensions ? c.extensions.split(',').filter(Boolean) : [],
    destination: c.destination,
    namingRule: c.namingRule,
    position: c.position,
  }
}

export function mapQueue(q: any): QueueDTO {
  return {
    id: q.id,
    name: q.name,
    maxConcurrent: q.maxConcurrent,
    connectionsPerDl: q.connectionsPerDl,
    speedLimit: q.speedLimit,
    priority: q.priority,
    active: q.active,
    startAt: q.startAt instanceof Date ? q.startAt.toISOString() : q.startAt || null,
    stopAt: q.stopAt instanceof Date ? q.stopAt.toISOString() : q.stopAt || null,
    retryMax: q.retryMax,
    endAction: q.endAction as QueueDTO['endAction'],
    createdAt:
      q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
    itemCount: q.items?.length ?? q._count?.items ?? 0,
  }
}
