'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/types'
import type { SegmentDTO } from '@/lib/types'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface SegmentsVizProps {
  segments: SegmentDTO[]
  /** Total file size (BigInt serialized as string). */
  size: string | number
  /** Overall progress 0..1 (used as fallback if no segments). */
  progress: number
}

const SEG_COLORS: Record<SegmentDTO['status'], string> = {
  completed: 'bg-emerald-600',
  downloading: 'bg-emerald-500 animate-pulse',
  pending: 'bg-muted-foreground/25',
  failed: 'bg-red-500',
  idle: 'bg-amber-500/70',
}

const SEG_LABEL: Record<SegmentDTO['status'], string> = {
  completed: 'Terminé',
  downloading: 'En cours',
  pending: 'En attente',
  failed: 'Échec',
  idle: 'Inactif',
}

export function SegmentsViz({ segments, size, progress }: SegmentsVizProps) {
  const totalSize = Number(size) || 0

  const segs = React.useMemo(() => {
    if (!segments || segments.length === 0) return []
    return [...segments].sort((a, b) => a.index - b.index)
  }, [segments])

  // Fallback single bar when no segments yet
  if (segs.length === 0 || totalSize <= 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progression globale</span>
          <span className="font-medium text-foreground">
            {Math.round((progress || 0) * 100)}%
          </span>
        </div>
        <Progress value={(progress || 0) * 100} className="h-2.5" />
        <p className="text-xs text-muted-foreground">
          Segments non encore alloués — l'analyse initiale déterminera les plages.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Carte des segments</span>
          <span>{segs.length} segment(s) · {formatBytes(totalSize)}</span>
        </div>
        <div
          className="flex h-4 w-full overflow-hidden rounded-md border bg-muted/40"
          role="img"
          aria-label="Carte des segments du fichier"
        >
          {segs.map((seg) => {
            const start = Number(seg.startByte)
            const end = Number(seg.endByte)
            const span = Math.max(1, end - start + 1)
            const widthPct = (span / totalSize) * 100
            const downloaded = Number(seg.downloadedBytes) || 0
            const segPct = Math.min(100, (downloaded / span) * 100)
            return (
              <div
                key={seg.id}
                className="relative h-full border-r border-background last:border-r-0"
                style={{ width: `${widthPct}%` }}
                title={`Segment ${seg.index} — ${SEG_LABEL[seg.status]} (${formatBytes(downloaded)} / ${formatBytes(span)})`}
              >
                {/* Base slice = status color */}
                <div className={cn('absolute inset-0', SEG_COLORS[seg.status])} />
                {/* Progress overlay (downloaded portion shown darker) */}
                {seg.status === 'downloading' && (
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-700/80"
                    style={{ width: `${segPct}%` }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(['downloading', 'completed', 'idle', 'pending', 'failed'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('inline-block size-2.5 rounded-sm', SEG_COLORS[s])} />
            <span>{SEG_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* Detailed list */}
      <div className="max-h-48 overflow-y-auto scrollbar-thin rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur">
            <tr>
              <th className="px-2 py-1 text-left font-medium">#</th>
              <th className="px-2 py-1 text-left font-medium">Worker</th>
              <th className="px-2 py-1 text-left font-medium">Plage</th>
              <th className="px-2 py-1 text-left font-medium">Reçu</th>
              <th className="px-2 py-1 text-left font-medium">Statut</th>
              <th className="px-2 py-1 text-left font-medium w-24">Progression</th>
            </tr>
          </thead>
          <tbody>
            {segs.map((seg) => {
              const start = Number(seg.startByte)
              const end = Number(seg.endByte)
              const span = Math.max(1, end - start + 1)
              const downloaded = Number(seg.downloadedBytes) || 0
              const pct = Math.min(100, (downloaded / span) * 100)
              return (
                <tr key={seg.id} className="border-t">
                  <td className="px-2 py-1 font-mono text-muted-foreground">{seg.index}</td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">{seg.workerId}</td>
                  <td className="px-2 py-1 font-mono text-muted-foreground">
                    {formatBytes(start)} – {formatBytes(end)}
                  </td>
                  <td className="px-2 py-1">
                    {formatBytes(downloaded)} <span className="text-muted-foreground">/ {formatBytes(span)}</span>
                  </td>
                  <td className="px-2 py-1">
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px]"
                    >
                      <span className={cn('inline-block size-1.5 rounded-sm', SEG_COLORS[seg.status])} />
                      {SEG_LABEL[seg.status]}
                    </Badge>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <Progress value={pct} className="h-1.5 w-16" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
