'use client'

import * as React from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Pause,
  Clock,
  HardDrive,
  Gauge,
} from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useDownloads } from '@/hooks/use-downloads'
import { formatBytes, formatSpeed, type DownloadStatus } from '@/lib/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { statusLabel } from '@/components/status-badge'

interface StatsResponse {
  counts: Partial<Record<DownloadStatus, number>>
  totalDownloads: number
  totalSize: string
  totalDownloaded: string
  activeSpeed: number
  byCategory: Record<string, number>
  activeCount: number
  queuedCount: number
  completedCount: number
  failedCount: number
  pausedCount: number
}

const STATUS_COLORS: Record<string, string> = {
  downloading: 'bg-emerald-500',
  completed: 'bg-emerald-700',
  queued: 'bg-slate-400',
  paused: 'bg-amber-500',
  failed: 'bg-red-500',
  cancelled: 'bg-slate-400',
  pending: 'bg-slate-400',
  analyzing: 'bg-amber-500',
  retrying: 'bg-amber-500',
}

const CATEGORY_COLORS = [
  'bg-emerald-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-pink-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-slate-500',
  'bg-lime-500',
]

export function StatsPanel() {
  const { data: stats, loading } = useAsync<StatsResponse>('/api/stats', {
    refreshMs: 5000,
  })
  const activeCount = useDownloads((s) => s.activeCount)
  const queuedCount = useDownloads((s) => s.queuedCount)

  if (loading && !stats) {
    return (
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      label: 'Actifs',
      value: activeCount ?? stats.activeCount ?? 0,
      icon: Activity,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'En file',
      value: queuedCount ?? stats.queuedCount ?? 0,
      icon: ListChecks,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Terminés',
      value: stats.completedCount ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Échoués',
      value: stats.failedCount ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'En pause',
      value: stats.pausedCount ?? 0,
      icon: Pause,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Total',
      value: stats.totalDownloads,
      icon: HardDrive,
      color: 'text-foreground',
    },
    {
      label: 'Volume téléchargé',
      value: formatBytes(stats.totalDownloaded),
      icon: HardDrive,
      color: 'text-foreground',
    },
    {
      label: 'Vitesse cumulée',
      value: formatSpeed(stats.activeSpeed),
      icon: Gauge,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
  ]

  const statusEntries = Object.entries(stats.counts).filter(([, n]) => n > 0)
  const maxStatus = Math.max(...statusEntries.map(([, n]) => n ?? 0), 1)
  const catEntries = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(...catEntries.map(([, n]) => n), 1)

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {c.label}
                    </CardTitle>
                    <Icon className={`size-4 ${c.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4" /> Répartition par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun téléchargement.</p>
            ) : (
              statusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-32 text-sm">{statusLabel(status as DownloadStatus)}</div>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${STATUS_COLORS[status] || 'bg-slate-400'}`}
                        style={{ width: `${((count ?? 0) / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-10 text-right text-sm font-mono">{count}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune catégorie.</p>
            ) : (
              catEntries.map(([cat, count], i) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm" title={cat}>
                    {cat}
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                        style={{ width: `${(count / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-10 text-right text-sm font-mono">{count}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Total size */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Volumes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-muted-foreground">Taille totale annoncée</span>
              <span className="font-mono font-medium">{formatBytes(stats.totalSize)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-muted-foreground">Volume reçu</span>
              <span className="font-mono font-medium">{formatBytes(stats.totalDownloaded)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
