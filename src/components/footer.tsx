'use client'

import { useDownloads } from '@/hooks/use-downloads'

export function Footer() {
  const connected = useDownloads((s) => s.connected)
  const activeCount = useDownloads((s) => s.activeCount)
  const queuedCount = useDownloads((s) => s.queuedCount)

  return (
    <footer
      className="mt-auto border-t border-border bg-muted/40"
      role="contentinfo"
    >
      <div className="flex h-7 items-center gap-4 px-3 text-[11px] text-muted-foreground sm:px-4">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
            aria-hidden
          />
          <span>{connected ? 'Connecté' : 'Hors ligne'}</span>
        </span>

        <span aria-hidden className="text-border">|</span>

        <span>
          <span className="font-medium text-foreground">{activeCount}</span>{' '}
          actif{activeCount > 1 ? 's' : ''}
        </span>

        <span>
          <span className="font-medium text-foreground">{queuedCount}</span> en
          file
        </span>

        <span className="ml-auto font-medium tracking-tight text-foreground/80">
          guymadown
        </span>
      </div>
    </footer>
  )
}
