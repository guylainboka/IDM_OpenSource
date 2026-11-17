'use client'

import * as React from 'react'
import {
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  CheckCheck,
  Settings,
  CalendarClock,
  ListStart,
  ListX,
  Globe,
  Upload,
  Download,
  PanelLeft,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useUI } from '@/hooks/use-ui'
import { useDownloads } from '@/hooks/use-downloads'
import { ThemeToggle } from '@/components/theme-toggle'

interface ToolButtonProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: 'emerald' | 'amber' | 'red' | 'neutral'
}

function ToolButton({ label, icon, onClick, disabled, accent = 'neutral' }: ToolButtonProps) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : accent === 'red'
          ? 'text-red-600 dark:text-red-400'
          : ''
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className="flex-col h-auto py-1.5 px-2 sm:px-3 sm:flex-row sm:py-2"
        >
          <span className={accentClass}>{icon}</span>
          <span className="text-[10px] leading-tight sm:text-sm sm:leading-none">
            {label}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function Toolbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { toast } = useToast()
  const selectedIds = useUI((s) => s.selectedIds)
  const setSearch = useUI((s) => s.setSearch)
  const search = useUI((s) => s.search)
  const setPanel = useUI((s) => s.setPanel)
  const clearSelected = useUI((s) => s.clearSelected)

  const downloads = useDownloads((s) => s.downloads)
  const resumeDownload = useDownloads((s) => s.resumeDownload)
  const pauseDownload = useDownloads((s) => s.pauseDownload)
  const fetchAll = useDownloads((s) => s.fetchAll)

  const hasSelection = selectedIds.length > 0

  const resumeSelected = React.useCallback(() => {
    const ids = hasSelection
      ? selectedIds
      : downloads.filter((d) => d.status === 'paused').map((d) => d.id)
    if (ids.length === 0) {
      toast({ title: 'Aucun téléchargement à reprendre', description: 'Sélectionnez au moins un élément en pause.' })
      return
    }
    ids.forEach((id) => resumeDownload(id))
    toast({ title: 'Reprise', description: `${ids.length} téléchargement(s) repris.` })
  }, [hasSelection, selectedIds, downloads, resumeDownload, toast])

  const pauseSelected = React.useCallback(() => {
    const ids = hasSelection
      ? selectedIds
      : downloads.filter((d) => d.status === 'downloading').map((d) => d.id)
    if (ids.length === 0) {
      toast({ title: 'Aucun téléchargement à arrêter', description: 'Sélectionnez au moins un élément en cours.' })
      return
    }
    ids.forEach((id) => pauseDownload(id))
    toast({ title: 'Pause', description: `${ids.length} téléchargement(s) mis en pause.` })
  }, [hasSelection, selectedIds, downloads, pauseDownload, toast])

  const pauseAll = React.useCallback(() => {
    const ids = downloads.filter((d) => d.status === 'downloading').map((d) => d.id)
    if (ids.length === 0) {
      toast({ title: 'Rien à arrêter', description: 'Aucun téléchargement actif.' })
      return
    }
    ids.forEach((id) => pauseDownload(id))
    toast({ title: 'Tout arrêté', description: `${ids.length} téléchargement(s) en pause.` })
  }, [downloads, pauseDownload, toast])

  const deleteSelected = React.useCallback(async () => {
    if (!hasSelection) return
    let ok = 0
    for (const id of selectedIds) {
      try {
        const r = await fetch(`/api/downloads/${id}`, { method: 'DELETE' })
        if (r.ok) ok++
      } catch {
        // ignore individual failures
      }
    }
    await fetchAll()
    clearSelected()
    toast({ title: 'Suppression', description: `${ok} téléchargement(s) supprimé(s).` })
  }, [hasSelection, selectedIds, fetchAll, clearSelected, toast])

  const deleteCompleted = React.useCallback(async () => {
    try {
      const r = await fetch('/api/downloads?scope=completed', { method: 'DELETE' })
      const data = await r.json()
      await fetchAll()
      toast({ title: 'Terminés supprimés', description: `${data.deleted} entrée(s) supprimée(s).` })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer les terminés.', variant: 'destructive' })
    }
  }, [fetchAll, toast])

  const exportSelection = React.useCallback(() => {
    const ids = hasSelection ? selectedIds : downloads.map((d) => d.id)
    if (ids.length === 0) {
      toast({ title: 'Rien à exporter', description: 'Aucun téléchargement sélectionné.' })
      return
    }
    const subset = downloads.filter((d) => ids.includes(d.id))
    const blob = new Blob([JSON.stringify(subset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guymadown-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Export', description: `${subset.length} entrée(s) exportée(s).` })
  }, [hasSelection, selectedIds, downloads, toast])

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-1 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3"
      role="toolbar"
      aria-label="Barre d'outils principale"
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => onToggleSidebar?.()}
        aria-label="Afficher la barre latérale"
      >
        <PanelLeft className="size-4" />
      </Button>

      <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-thin">
        <ToolButton
          label="Ajouter"
          icon={<Plus className="size-4" />}
          onClick={() => setPanel('add')}
          accent="emerald"
        />
        <ToolButton
          label="Reprendre"
          icon={<Play className="size-4" />}
          onClick={resumeSelected}
          disabled={downloads.length === 0}
          accent="emerald"
        />
        <ToolButton
          label="Arrêter"
          icon={<Pause className="size-4" />}
          onClick={pauseSelected}
          disabled={downloads.length === 0}
          accent="amber"
        />
        <ToolButton
          label="Tout arrêter"
          icon={<Square className="size-4" />}
          onClick={pauseAll}
          disabled={downloads.every((d) => d.status !== 'downloading')}
          accent="amber"
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasSelection}
              className="flex-col h-auto py-1.5 px-2 sm:flex-row sm:py-2 sm:px-3 text-red-600 dark:text-red-400"
            >
              <Trash2 className="size-4" />
              <span className="text-[10px] sm:text-sm">Supprimer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera {selectedIds.length} téléchargement(s) et
                leurs fichiers associés. Action irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteSelected}
                className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ToolButton
          label="Suppr. terminés"
          icon={<CheckCheck className="size-4" />}
          onClick={deleteCompleted}
          disabled={!downloads.some((d) => d.status === 'completed')}
        />

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <ToolButton
          label="Options"
          icon={<Settings className="size-4" />}
          onClick={() => setPanel('settings')}
        />
        <ToolButton
          label="Planificateur"
          icon={<CalendarClock className="size-4" />}
          onClick={() => setPanel('scheduler')}
        />
        <ToolButton
          label="Démarrer file"
          icon={<ListStart className="size-4" />}
          onClick={() => setPanel('queues')}
          accent="emerald"
        />
        <ToolButton
          label="Arrêter file"
          icon={<ListX className="size-4" />}
          onClick={() => setPanel('queues')}
          accent="amber"
        />
        <ToolButton
          label="Grabber"
          icon={<Globe className="size-4" />}
          onClick={() => setPanel('grabber')}
        />
        <ToolButton
          label="Importer"
          icon={<Upload className="size-4" />}
          onClick={() => setPanel('batch')}
        />
        <ToolButton
          label="Exporter"
          icon={<Download className="size-4" />}
          onClick={exportSelection}
          disabled={downloads.length === 0}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="h-8 w-44 pl-7 text-sm lg:w-64"
            aria-label="Recherche dans les téléchargements"
          />
        </div>
        <ThemeToggle />
        <ConnectionBadge />
      </div>
    </header>
  )
}

function ConnectionBadge() {
  const connected = useDownloads((s) => s.connected)
  return (
    <span
      className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:inline-flex"
      aria-label={connected ? 'Connecté au moteur' : 'Déconnecté du moteur'}
    >
      <span
        className={`size-2 rounded-full ${
          connected ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      <span className={connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
        {connected ? 'En ligne' : 'Hors ligne'}
      </span>
    </span>
  )
}
