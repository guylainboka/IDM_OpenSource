'use client'

import * as React from 'react'
import {
  Globe,
  Loader2,
  Download,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  FileCode,
  File,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import { useDownloads } from '@/hooks/use-downloads'
import type { GrabberResource } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

type ResourceType = GrabberResource['type']

const TYPE_LABELS: Record<ResourceType, string> = {
  page: 'Pages',
  image: 'Images',
  video: 'Vidéos',
  audio: 'Audio',
  document: 'Documents',
  archive: 'Archives',
  script: 'Scripts',
  style: 'Styles',
  other: 'Autres',
}

const TYPE_ICONS: Partial<Record<ResourceType, React.ComponentType<{ className?: string }>>> = {
  page: File,
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
  archive: Archive,
  script: FileCode,
  style: FileCode,
  other: File,
}

interface CrawlResult {
  url: string
  title: string | null
  resourceCount: number
  resources: GrabberResource[]
}

export function GrabberPanel() {
  const { toast } = useToast()
  const addDownload = useDownloads((s) => s.addDownload)

  const [url, setUrl] = React.useState('')
  const [extFilter, setExtFilter] = React.useState('')
  const [crawling, setCrawling] = React.useState(false)
  const [result, setResult] = React.useState<CrawlResult | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [filter, setFilter] = React.useState<'all' | ResourceType>('all')
  const [search, setSearch] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  const crawl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^https?:\/\//i.test(url.trim())) {
      toast({ title: 'URL invalide', description: 'Saisissez une URL HTTP(S).', variant: 'destructive' })
      return
    }
    setCrawling(true)
    setResult(null)
    setSelected(new Set())
    try {
      const res = await fetch('/api/grabber/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), extensions: extFilter.trim() || undefined }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Échec du crawl')
      }
      const data = (await res.json()) as CrawlResult
      setResult(data)
      toast({
        title: 'Crawl terminé',
        description: `${data.resourceCount} ressource(s) trouvée(s) sur ${data.title || data.url}.`,
      })
    } catch (err) {
      toast({
        title: 'Erreur de crawl',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setCrawling(false)
    }
  }

  const filtered = React.useMemo(() => {
    if (!result) return []
    return result.resources.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!r.url.toLowerCase().includes(s) && !r.filename.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [result, filter, search])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = {}
    if (!result) return m
    for (const r of result.resources) m[r.type] = (m[r.type] || 0) + 1
    return m
  }, [result])

  const toggle = (u: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(u)) next.delete(u)
      else next.add(u)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of filtered) next.add(r.url)
      return next
    })
  }
  const clearAll = () => setSelected(new Set())

  const addSelected = async () => {
    if (selected.size === 0) return
    setAdding(true)
    let ok = 0
    let fail = 0
    for (const u of selected) {
      try {
        const r = await addDownload({ url: u })
        if (r.ok) ok++
        else fail++
      } catch {
        fail++
      }
    }
    setAdding(false)
    toast({
      title: 'Téléchargements ajoutés',
      description: `${ok} ajouté(s)${fail > 0 ? `, ${fail} échec(s)` : ''}.`,
    })
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Crawl form */}
        <form onSubmit={crawl} className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
            Aspirateur de sites
          </h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="grabber-url">URL de la page à analyser</Label>
              <Input
                id="grabber-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/page.html"
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={crawling} className="gap-2">
                {crawling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Crawler
              </Button>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            <Label htmlFor="grabber-ext">Filtrer par extensions (optionnel)</Label>
            <Input
              id="grabber-ext"
              value={extFilter}
              onChange={(e) => setExtFilter(e.target.value)}
              placeholder="jpg,png,pdf"
              className="sm:w-64"
            />
          </div>
        </form>

        {/* Results */}
        {crawling && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border">
            <div className="border-b p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {result.title || 'Page sans titre'}
                  </p>
                  <p className="text-xs text-muted-foreground">{result.url}</p>
                </div>
                <Badge variant="secondary">
                  {result.resourceCount} ressource(s)
                </Badge>
              </div>
            </div>

            <div className="space-y-2 p-3">
              {/* Tabs + search */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="all">Tous ({result.resourceCount})</TabsTrigger>
                    {(Object.keys(TYPE_LABELS) as ResourceType[]).map((t) =>
                      counts[t] ? (
                        <TabsTrigger key={t} value={t}>
                          {TYPE_LABELS[t]} ({counts[t]})
                        </TabsTrigger>
                      ) : null,
                    )}
                  </TabsList>
                </Tabs>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer…"
                    className="h-8 w-44 pl-7 text-sm"
                  />
                </div>
              </div>

              {/* Bulk actions */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <CheckSquare className="size-3.5" /> Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Square className="size-3.5" /> Vider
                  </button>
                  <span className="text-muted-foreground">
                    {selected.size} sélectionné(s)
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={addSelected}
                  disabled={selected.size === 0 || adding}
                  className="gap-1.5"
                >
                  {adding ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Télécharger la sélection
                </Button>
              </div>

              {/* Resource list */}
              <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin rounded-md border">
                {filtered.map((r) => {
                  const Icon = TYPE_ICONS[r.type] || File
                  const checked = selected.has(r.url)
                  return (
                    <li
                      key={r.url}
                      className={cn(
                        'flex items-center gap-2 p-2 text-xs transition-colors',
                        checked ? 'bg-emerald-500/10' : 'hover:bg-muted/40',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(r.url)}
                      />
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium" title={r.filename}>
                          {r.filename}
                        </p>
                        <p className="truncate text-muted-foreground" title={r.url}>
                          {r.url}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[r.type]}
                      </Badge>
                      {r.extension && (
                        <Badge variant="secondary" className="text-[10px]">
                          .{r.extension}
                        </Badge>
                      )}
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="p-3 text-center text-sm text-muted-foreground">
                    Aucune ressource ne correspond.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {!result && !crawling && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Saisissez une URL ci-dessus et lancez le crawl pour lister les
            ressources téléchargeables de la page.
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
