'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DownloadStatus } from '@/lib/types'

interface StatusMeta {
  label: string
  className: string
}

const STATUS_MAP: Record<DownloadStatus, StatusMeta> = {
  pending: {
    label: 'En attente',
    className:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  analyzing: {
    label: 'Analyse',
    className:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  queued: {
    label: 'En file',
    className:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  downloading: {
    label: 'Téléchargement',
    className:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  },
  paused: {
    label: 'En pause',
    className:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  completed: {
    label: 'Terminé',
    className:
      'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/40',
  },
  failed: {
    label: 'Échec',
    className:
      'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
  },
  cancelled: {
    label: 'Annulé',
    className:
      'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
  retrying: {
    label: 'Nouvelle tentative',
    className:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: DownloadStatus
  className?: string
}) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.pending
  const isDownloading = status === 'downloading'
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        meta.className,
        isDownloading && 'animate-pulse',
        className,
      )}
    >
      {isDownloading && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {meta.label}
    </Badge>
  )
}

export function statusLabel(status: DownloadStatus): string {
  return STATUS_MAP[status]?.label ?? status
}
