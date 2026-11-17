'use client'

import * as React from 'react'
import {
  Play,
  Pause,
  XCircle,
  FolderOpen,
  Gauge,
  AlertTriangle,
} from 'lucide-react'

import {
  formatBytes,
  formatSpeed,
  formatEta,
  type DownloadDTO,
  type ErrorLogDTO,
} from '@/lib/types'
import { useDownloads } from '@/hooks/use-downloads'
import { useUI } from '@/hooks/use-ui'
import { useToast } from '@/hooks/use-toast'
import { useAsync } from '@/hooks/use-async'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { SegmentsViz } from '@/components/segments-viz'

export function DownloadDetailDrawer() {
  const detailId = useUI((s) => s.detailId)
  const setDetailId = useUI((s) => s.setDetailId)
  const downloads = useDownloads((s) => s.downloads)
  const download = detailId
    ? downloads.find((d) => d.id === detailId) || null
    : null

  const open = !!detailId

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setDetailId(null)}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-lg md:max-w-xl"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="truncate text-base">
            {download?.filename || 'Détails du téléchargement'}
          </SheetTitle>
          <SheetDescription className="truncate">
            {download?.url}
          </SheetDescription>
        </SheetHeader>
        {download ? (
          <DetailBody download={download} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailBody({ download }: { download: DownloadDTO }) {
  const { toast } = useToast()
  const resumeDownload = useDownloads((s) => s.resumeDownload)
  const pauseDownload = useDownloads((s) => s.pauseDownload)
  const cancelDownload = useDownloads((s) => s.cancelDownload)
  const setSpeedLimit = useDownloads((s) => s.setSpeedLimit)

  // speed limit local state
  const [speedLimit, setSpeedLimitState] = React.useState<number>(0)
  React.useEffect(() => {
    // initialize from download? we don't have current limit per dl; default 0
    setSpeedLimitState(0)
  }, [download.id])

  // errors
  const { data: errors, loading: errorsLoading, reload: reloadErrors } = useAsync<ErrorLogDTO[]>(
    `/api/errors?downloadId=${encodeURIComponent(download.id)}&limit=50`,
  )

  const isActive = download.status === 'downloading' || download.status === 'retrying'
  const isPaused = download.status === 'paused'
  const isCompleted = download.status === 'completed'

  const stats: Array<[string, React.ReactNode]> = [
    ['Taille totale', formatBytes(download.size)],
    ['Reçu', formatBytes(download.downloaded)],
    ['Vitesse instantanée', isActive ? formatSpeed(download.speed) : '—'],
    ['Vitesse moyenne', isActive ? formatSpeed(download.avgSpeed) : '—'],
    ['Temps restant', isActive ? formatEta(download.eta) : '—'],
    ['Connexions', String(download.connections)],
    ['MIME', download.mimeType || '—'],
    ['Serveur', download.server || '—'],
    ['ETag', download.etag || '—'],
    ['Last-Modified', download.lastModified || '—'],
    ["Date d'ajout", new Date(download.addedAt).toLocaleString('fr-FR')],
    ['Dernière tentative', download.lastTryAt ? new Date(download.lastTryAt).toLocaleString('fr-FR') : '—'],
  ]

  return (
    <div className="flex h-[calc(100%-72px)] flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Header info */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={download.status} />
              <Badge variant="outline" className="text-[11px]">
                {download.category}
              </Badge>
              {download.supportsRange && (
                <Badge variant="secondary" className="text-[11px]">
                  Reprise supportée
                </Badge>
              )}
              {download.retries > 0 && (
                <Badge variant="outline" className="text-[11px] text-amber-700 dark:text-amber-300">
                  {download.retries} retry
                </Badge>
              )}
            </div>
            {download.error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="break-all">{download.error}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isActive}
                onClick={() => resumeDownload(download.id)}
                className="gap-1.5 text-emerald-700 dark:text-emerald-300"
              >
                <Play className="size-3.5" /> Reprendre
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!isActive}
                onClick={() => pauseDownload(download.id)}
                className="gap-1.5"
              >
                <Pause className="size-3.5" /> Arrêter
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={download.status === 'cancelled' || isCompleted}
                onClick={() => cancelDownload(download.id)}
                className="gap-1.5 text-red-700 dark:text-red-300"
              >
                <XCircle className="size-3.5" /> Annuler
              </Button>
              {isCompleted && (
                <Button asChild size="sm" className="gap-1.5">
                  <a href={`/api/files/${download.id}`} download>
                    <FolderOpen className="size-3.5" /> Ouvrir le fichier
                  </a>
                </Button>
              )}
            </div>
          </section>

          <Separator />

          {/* Stats grid */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Informations
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {stats.map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator />

          {/* Segments */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Segments
            </h3>
            <SegmentsViz
              segments={download.segments ?? []}
              size={download.size}
              progress={download.progress}
            />
          </section>

          <Separator />

          {/* Speed limit */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Limiteur de vitesse
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Gauge className="size-4" /> Limite
                </span>
                <span className="font-mono">
                  {speedLimit === 0
                    ? 'Illimitée'
                    : `${formatBytes(speedLimit * 1024 * 1024)}/s`}
                </span>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[speedLimit]}
                onValueChange={(v) => setSpeedLimitState(v[0] ?? 0)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0</span>
                <span>5</span>
                <span>10 MB/s</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSpeedLimit(download.id, speedLimit)
                  toast({
                    title: 'Limite appliquée',
                    description: speedLimit === 0 ? 'Aucune limite' : `${speedLimit} MB/s`,
                  })
                }}
              >
                Appliquer
              </Button>
            </div>
          </section>

          <Separator />

          {/* Error history */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Historique des erreurs
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => reloadErrors()}
              >
                Rafraîchir
              </Button>
            </div>
            {errorsLoading ? (
              <div className="space-y-1">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : errors && errors.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin rounded-md border">
                {errors.map((e) => (
                  <li
                    key={e.id}
                    className="border-b p-2 text-xs last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] text-red-700 dark:text-red-300">
                        {e.code}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-muted-foreground">{e.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune erreur enregistrée.</p>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
