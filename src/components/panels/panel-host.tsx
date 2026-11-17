'use client'

import * as React from 'react'
import { ArrowLeft, X } from 'lucide-react'

import { useUI, type Panel as PanelType } from '@/hooks/use-ui'
import { Button } from '@/components/ui/button'

import { CategoriesPanel } from '@/components/panels/categories-panel'
import { QueuesPanel } from '@/components/panels/queues-panel'
import { SchedulerPanel } from '@/components/panels/scheduler-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { GrabberPanel } from '@/components/panels/grabber-panel'
import { BatchPanel } from '@/components/panels/batch-panel'
import { FilesPanel } from '@/components/panels/files-panel'
import { ErrorsPanel } from '@/components/panels/errors-panel'
import { StatsPanel } from '@/components/panels/stats-panel'

const TITLES: Record<Exclude<PanelType, 'none' | 'add'>, string> = {
  categories: 'Catégories',
  queues: 'Files d\'attente',
  scheduler: 'Planificateur',
  settings: 'Options',
  grabber: 'Grabber de sites',
  batch: 'Téléchargement par lots',
  files: 'Fichiers téléchargés',
  errors: 'Journal d\'erreurs',
  stats: 'Statistiques',
}

export function PanelHost() {
  const panel = useUI((s) => s.panel)
  const setPanel = useUI((s) => s.setPanel)
  const close = React.useCallback(() => setPanel('none'), [setPanel])

  if (panel === 'none' || panel === 'add') return null

  const title = TITLES[panel]

  return (
    <section
      className="flex h-full flex-col overflow-hidden"
      aria-label={title}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={close}
          aria-label="Retour aux téléchargements"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          onClick={close}
          aria-label="Fermer le panneau"
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-hidden">
        {panel === 'categories' && <CategoriesPanel />}
        {panel === 'queues' && <QueuesPanel />}
        {panel === 'scheduler' && <SchedulerPanel />}
        {panel === 'settings' && <SettingsPanel />}
        {panel === 'grabber' && <GrabberPanel />}
        {panel === 'batch' && <BatchPanel />}
        {panel === 'files' && <FilesPanel />}
        {panel === 'errors' && <ErrorsPanel />}
        {panel === 'stats' && <StatsPanel />}
      </div>
    </section>
  )
}
