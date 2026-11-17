'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Row,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  Copy,
  FolderOpen,
  Play,
  Pause,
  XCircle,
  Trash2,
  Plus,
  Inbox,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  formatBytes,
  formatSpeed,
  formatEta,
  type DownloadDTO,
} from '@/lib/types'
import { useDownloads } from '@/hooks/use-downloads'
import { useUI, type SidebarView } from '@/hooks/use-ui'
import { useToast } from '@/hooks/use-toast'
import { useAsync } from '@/hooks/use-async'
import type { CategoryDTO } from '@/lib/types'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

function viewMatches(view: SidebarView, d: DownloadDTO): boolean {
  if (view === 'all') return true
  if (view === 'incomplete') {
    return ['pending', 'analyzing', 'queued', 'downloading', 'paused', 'retrying'].includes(d.status)
  }
  if (view === 'completed') return d.status === 'completed'
  if (view === 'failed') return d.status === 'failed'
  if (typeof view === 'object' && view.type === 'category') return d.category === view.name
  if (typeof view === 'object' && view.type === 'queue') return d.queueId === view.id
  if (typeof view === 'object' && view.type === 'grabber') return false
  return true
}

export function DownloadsTable() {
  const downloads = useDownloads((s) => s.downloads)
  const loaded = useDownloads((s) => s.loaded)
  const view = useUI((s) => s.view)
  const search = useUI((s) => s.search)
  const selectedIds = useUI((s) => s.selectedIds)
  const setSelectedIds = useUI((s) => s.setSelectedIds)
  const toggleSelected = useUI((s) => s.toggleSelected)
  const clearSelected = useUI((s) => s.clearSelected)
  const setDetailId = useUI((s) => s.setDetailId)
  const setPanel = useUI((s) => s.setPanel)

  const { data: categories } = useAsync<CategoryDTO[]>('/api/categories')
  const catColorMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories ?? []) m.set(c.name, c.color)
    return m
  }, [categories])

  const filtered = React.useMemo(() => {
    const s = search.trim().toLowerCase()
    return downloads.filter((d) => {
      if (!viewMatches(view, d)) return false
      if (s) {
        const hay = `${d.filename} ${d.url}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [downloads, view, search])

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'addedAt', desc: true },
  ])

  const columns = React.useMemo<ColumnDef<DownloadDTO>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              filtered.length > 0 &&
              filtered.every((d) => selectedIds.includes(d.id))
            }
            onCheckedChange={(v) => {
              if (v) {
                setSelectedIds(filtered.map((d) => d.id))
              } else {
                clearSelected()
              }
            }}
            aria-label="Sélectionner tout"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            onCheckedChange={() => toggleSelected(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Sélectionner ${row.original.filename}`}
          />
        ),
        enableSorting: false,
        size: 36,
      },
      {
        id: 'filename',
        accessorKey: 'filename',
        header: 'Nom',
        cell: ({ row }) => {
          const d = row.original
          return (
            <button
              type="button"
              onClick={() => setDetailId(d.id)}
              className="block max-w-[28ch] truncate text-left font-medium hover:underline sm:max-w-[40ch]"
              title={d.filename}
            >
              {d.filename}
            </button>
          )
        },
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Catégorie',
        cell: ({ row }) => {
          const cat = row.original.category
          const color = catColorMap.get(cat)
          return (
            <Badge variant="outline" className="gap-1.5 text-[11px]">
              {color && (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              )}
              {cat}
            </Badge>
          )
        },
        size: 110,
      },
      {
        id: 'size',
        accessorFn: (d) => Number(d.size),
        header: 'Taille',
        cell: ({ row }) => {
          const d = row.original
          return (
            <div className="flex flex-col">
              <span className="font-medium">{formatBytes(d.size)}</span>
              {d.status === 'downloading' && (
                <span className="text-[10px] text-muted-foreground">
                  {formatBytes(d.downloaded)}
                </span>
              )}
            </div>
          )
        },
        size: 90,
      },
      {
        id: 'progress',
        accessorFn: (d) => d.progress,
        header: 'Progression',
        cell: ({ row }) => {
          const d = row.original
          const pct = Math.round((d.progress || 0) * 100)
          const isActive = d.status === 'downloading'
          return (
            <div className="flex w-32 items-center gap-2">
              <Progress
                value={pct}
                className={cn('h-1.5', isActive && '[&>div]:bg-emerald-500')}
              />
              <span className="w-9 text-right text-[11px] font-mono text-muted-foreground">
                {pct}%
              </span>
            </div>
          )
        },
        size: 160,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 130,
      },
      {
        id: 'speed',
        accessorFn: (d) => d.speed,
        header: 'Vitesse',
        cell: ({ row }) => {
          const d = row.original
          if (d.status !== 'downloading') return <span className="text-muted-foreground">—</span>
          return (
            <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
              {formatSpeed(d.speed)}
            </span>
          )
        },
        size: 90,
      },
      {
        id: 'eta',
        accessorFn: (d) => d.eta,
        header: 'Temps restant',
        cell: ({ row }) => {
          const d = row.original
          if (d.status !== 'downloading') return <span className="text-muted-foreground">—</span>
          return <span className="font-mono text-xs">{formatEta(d.eta)}</span>
        },
        size: 100,
      },
      {
        id: 'addedAt',
        accessorFn: (d) => new Date(d.addedAt).getTime(),
        header: "Date d'ajout",
        cell: ({ row }) => {
          const d = row.original
          const date = new Date(d.addedAt)
          return (
            <span className="font-mono text-[11px] text-muted-foreground">
              {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              {' '}
              {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )
        },
        size: 130,
      },
    ],
    [catColorMap, filtered, selectedIds, setSelectedIds, toggleSelected, clearSelected, setDetailId],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (!loaded) {
    return <TableSkeleton />
  }

  if (downloads.length === 0) {
    return <EmptyState onAdd={() => setPanel('add')} />
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Inbox className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Aucun téléchargement ne correspond à la vue / recherche courante.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="h-8 text-[11px] uppercase tracking-wider"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <RowWithContextMenu key={row.original.id} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RowWithContextMenu({ row }: { row: Row<DownloadDTO> }) {
  const d = row.original
  const { toast } = useToast()
  const setDetailId = useUI((s) => s.setDetailId)
  const setSelectedIds = useUI((s) => s.setSelectedIds)
  const resumeDownload = useDownloads((s) => s.resumeDownload)
  const pauseDownload = useDownloads((s) => s.pauseDownload)
  const cancelDownload = useDownloads((s) => s.cancelDownload)
  const fetchAll = useDownloads((s) => s.fetchAll)

  const isActive = d.status === 'downloading' || d.status === 'retrying'
  const isPaused = d.status === 'paused'
  const isCompleted = d.status === 'completed'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          data-state={undefined}
          onClick={() => {
            setSelectedIds([d.id])
            setDetailId(d.id)
          }}
          className="cursor-pointer"
        >
          {row.getVisibleCells().map((cell) => (
            <TableCell key={cell.id} className="py-1.5">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            if (isPaused || d.status === 'failed') resumeDownload(d.id)
            else setDetailId(d.id)
          }}
        >
          <Play className="size-4" /> Reprendre
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!isActive}
          onClick={() => pauseDownload(d.id)}
        >
          <Pause className="size-4" /> Arrêter
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => cancelDownload(d.id)}
        >
          <XCircle className="size-4" /> Annuler
        </ContextMenuItem>
        <ContextMenuItem
          onClick={async () => {
            await fetch(`/api/downloads/${d.id}`, { method: 'DELETE' })
            await fetchAll()
            toast({ title: 'Supprimé', description: d.filename })
          }}
        >
          <Trash2 className="size-4" /> Supprimer
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setDetailId(d.id)}>
          <Eye className="size-4" /> Ouvrir les détails
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.writeText(d.url)
            toast({ title: 'URL copiée', description: d.url })
          }}
        >
          <Copy className="size-4" /> Copier l'URL
        </ContextMenuItem>
        {isCompleted && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem asChild>
              <a href={`/api/files/${d.id}`} download>
                <FolderOpen className="size-4" /> Télécharger le fichier
              </a>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function TableSkeleton() {
  return (
    <div className="p-3">
      <div className="mb-2 flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6 flex-1" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="mb-1 h-9 w-full" />
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full border border-dashed p-6">
        <Inbox className="size-10 text-muted-foreground/60" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">Aucun téléchargement</p>
        <p className="text-sm text-muted-foreground">
          Ajoutez une URL pour démarrer un téléchargement.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="size-4" /> Ajouter une URL
      </Button>
    </div>
  )
}
