'use client'

import * as React from 'react'
import {
  ListTodo,
  CircleSlash,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Globe,
  Plus,
  ChevronDown,
  ChevronRight,
  Inbox,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUI, type SidebarView } from '@/hooks/use-ui'
import { useDownloads } from '@/hooks/use-downloads'
import { useAsync } from '@/hooks/use-async'
import type { CategoryDTO, QueueDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'

function viewEqual(a: SidebarView, b: SidebarView): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (typeof a !== 'string' && typeof b !== 'string') {
    if (a.type !== b.type) return false
    if (a.type === 'category' && b.type === 'category') return a.name === b.name
    if (a.type === 'queue' && b.type === 'queue') return a.id === b.id
    if (a.type === 'grabber' && b.type === 'grabber') return true
  }
  return false
}

interface SidebarProps {
  /** Called when a view is selected (used to close the mobile sheet). */
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const view = useUI((s) => s.view)
  const setView = useUI((s) => s.setView)
  const setPanel = useUI((s) => s.setPanel)
  const downloads = useDownloads((s) => s.downloads)

  const { data: categories, loading: catLoading } = useAsync<CategoryDTO[]>('/api/categories')
  const { data: queues, loading: qLoading } = useAsync<QueueDTO[]>('/api/queues')

  const counts = React.useMemo(() => {
    const c = {
      all: downloads.length,
      incomplete: 0,
      completed: 0,
      failed: 0,
      byCategory: {} as Record<string, number>,
      byQueue: {} as Record<string, number>,
    }
    for (const d of downloads) {
      if (['pending', 'analyzing', 'queued', 'downloading', 'paused', 'retrying'].includes(d.status)) {
        c.incomplete++
      }
      if (d.status === 'completed') c.completed++
      if (d.status === 'failed') c.failed++
      c.byCategory[d.category] = (c.byCategory[d.category] || 0) + 1
      if (d.queueId) c.byQueue[d.queueId] = (c.byQueue[d.queueId] || 0) + 1
    }
    return c
  }, [downloads])

  const pick = React.useCallback(
    (v: SidebarView) => {
      setView(v)
      onNavigate?.()
    },
    [setView, onNavigate],
  )

  const views = [
    { key: 'all' as const, label: 'Tous', icon: ListTodo, count: counts.all },
    { key: 'incomplete' as const, label: 'Incomplets', icon: CircleSlash, count: counts.incomplete },
    { key: 'completed' as const, label: 'Terminés', icon: CheckCircle2, count: counts.completed },
    { key: 'failed' as const, label: 'Échoués', icon: AlertTriangle, count: counts.failed },
  ]

  return (
    <nav
      aria-label="Navigation latérale"
      className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground"
    >
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-3">
          {/* Vues */}
          <Section title="Vues" defaultOpen>
            <ul className="flex flex-col gap-0.5">
              {views.map((v) => {
                const Icon = v.icon
                const active = viewEqual(view, v.key)
                return (
                  <li key={v.key}>
                    <button
                      type="button"
                      onClick={() => pick(v.key)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{v.label}</span>
                      {v.count > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {v.count}
                        </Badge>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Section>

          {/* Catégories */}
          <Section
            title="Catégories"
            defaultOpen
            action={
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setPanel('categories')}
                aria-label="Gérer les catégories"
              >
                <Plus className="size-3.5" />
              </Button>
            }
          >
            {catLoading ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {(categories ?? []).map((cat) => {
                  const v: SidebarView = { type: 'category', name: cat.name }
                  const active = viewEqual(view, v)
                  const count = counts.byCategory[cat.name] || 0
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => pick(v)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )}
                        title={cat.destination || cat.name}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                          aria-hidden
                        />
                        <span className="flex-1 truncate text-left">{cat.name}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {count}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
                {(!categories || categories.length === 0) && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aucune catégorie.
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* Files d'attente */}
          <Section
            title="Files d'attente"
            defaultOpen
            action={
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setPanel('queues')}
                aria-label="Gérer les files"
              >
                <Plus className="size-3.5" />
              </Button>
            }
          >
            {qLoading ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {(queues ?? []).map((q) => {
                  const v: SidebarView = { type: 'queue', id: q.id, name: q.name }
                  const active = viewEqual(view, v)
                  const count = q.itemCount ?? counts.byQueue[q.id] ?? 0
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => pick(v)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )}
                      >
                        {q.active ? (
                          <span className="relative flex size-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                          </span>
                        ) : (
                          <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-left">{q.name}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {count}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
                {(!queues || queues.length === 0) && (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aucune file. Cliquez sur + pour en créer une.
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* Grabber */}
          <Section title="Projets" defaultOpen>
            <ul className="flex flex-col gap-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => pick({ type: 'grabber' })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    viewEqual(view, { type: 'grabber' })
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium'
                      : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Globe className="size-4 shrink-0" />
                  <span className="flex-1 text-left">Grabber</span>
                </button>
              </li>
            </ul>
          </Section>

          <div className="mt-auto px-2 pb-2 pt-4 text-[10px] text-muted-foreground/70">
            <div className="flex items-center gap-1">
              <Inbox className="size-3" />
              <span>{downloads.length} téléchargement(s)</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </nav>
  )
}

function Section({
  title,
  children,
  defaultOpen,
  action,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  action?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(!!defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mb-1 flex items-center gap-1 px-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span>{title}</span>
          </button>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
