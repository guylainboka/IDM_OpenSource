'use client'

import * as React from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  Play,
  Square,
  ListChecks,
  Users,
} from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import { useDownloads } from '@/hooks/use-downloads'
import type { QueueDTO, DownloadDTO } from '@/lib/types'
import { formatBytes } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function QueuesPanel() {
  const { data: queues, loading, reload } = useAsync<QueueDTO[]>('/api/queues')
  const { toast } = useToast()
  const startQueue = useDownloads((s) => s.startQueue)
  const stopQueue = useDownloads((s) => s.stopQueue)

  const [selectedQueueId, setSelectedQueueId] = React.useState<string | null>(null)

  // pick first queue when loaded
  React.useEffect(() => {
    if (!selectedQueueId && queues && queues.length > 0) {
      setSelectedQueueId(queues[0].id)
    }
  }, [queues, selectedQueueId])

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          {/* Left: queue list + add form */}
          <div className="space-y-4">
            <QueueAddForm onCreated={reload} />
            <div className="rounded-lg border">
              <div className="border-b p-3">
                <h3 className="text-sm font-semibold">Files ({queues?.length ?? 0})</h3>
              </div>
              {loading ? (
                <div className="space-y-1 p-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y">
                  {(queues ?? []).map((q) => (
                    <li
                      key={q.id}
                      className={`cursor-pointer p-3 transition-colors ${
                        selectedQueueId === q.id ? 'bg-emerald-500/10' : 'hover:bg-muted/40'
                      }`}
                      onClick={() => setSelectedQueueId(q.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {q.active ? (
                            <span className="relative flex size-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                            </span>
                          ) : (
                            <ListChecks className="size-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{q.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {q.itemCount} élém.
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>Max: {q.maxConcurrent}</span>
                        <span>Conn/dl: {q.connectionsPerDl}</span>
                        <span>Limite: {q.speedLimit ? formatBytes(q.speedLimit) + '/s' : '—'}</span>
                        <span>Priorité: {q.priority}</span>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-emerald-700 dark:text-emerald-300"
                          disabled={q.active}
                          onClick={(e) => {
                            e.stopPropagation()
                            startQueue(q.id)
                            toast({ title: 'File démarrée', description: q.name })
                          }}
                        >
                          <Play className="size-3" /> Démarrer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-amber-700 dark:text-amber-300"
                          disabled={!q.active}
                          onClick={(e) => {
                            e.stopPropagation()
                            stopQueue(q.id)
                            toast({ title: 'File arrêtée', description: q.name })
                          }}
                        >
                          <Square className="size-3" /> Arrêter
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto size-7 text-red-600 dark:text-red-400"
                          onClick={async (e) => {
                            e.stopPropagation()
                            await fetch(`/api/queues/${q.id}`, { method: 'DELETE' })
                            toast({ title: 'File supprimée', description: q.name })
                            if (selectedQueueId === q.id) setSelectedQueueId(null)
                            await reload()
                          }}
                          aria-label={`Supprimer ${q.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {(!queues || queues.length === 0) && (
                    <li className="p-3 text-center text-sm text-muted-foreground">
                      Aucune file. Créez-en une ci-dessus.
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Right: items of selected queue */}
          <div className="space-y-3">
            <QueueItems queueId={selectedQueueId} />
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function QueueAddForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { toast } = useToast()
  const [name, setName] = React.useState('')
  const [maxConcurrent, setMaxConcurrent] = React.useState('2')
  const [connectionsPerDl, setConnectionsPerDl] = React.useState('8')
  const [speedLimit, setSpeedLimit] = React.useState('0')
  const [priority, setPriority] = React.useState('0')
  const [creating, setCreating] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          maxConcurrent: Number(maxConcurrent),
          connectionsPerDl: Number(connectionsPerDl),
          speedLimit: Number(speedLimit),
          priority: Number(priority),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: 'File créée', description: name })
      setName('')
      await onCreated()
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Nouvelle file d'attente</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="q-name">Nom</Label>
          <Input
            id="q-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="File principale"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-max">Max simultanés</Label>
          <Select value={maxConcurrent} onValueChange={setMaxConcurrent}>
            <SelectTrigger id="q-max" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-conn">Connexions / dl</Label>
          <Select value={connectionsPerDl} onValueChange={setConnectionsPerDl}>
            <SelectTrigger id="q-conn" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 4, 8, 16, 32].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-limit">Limite vitesse (KB/s)</Label>
          <Input
            id="q-limit"
            type="number"
            min={0}
            value={speedLimit}
            onChange={(e) => setSpeedLimit(e.target.value)}
            placeholder="0 = illimité"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-prio">Priorité</Label>
          <Input
            id="q-prio"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={creating} className="gap-2">
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Créer
        </Button>
      </div>
    </form>
  )
}

function QueueItems({ queueId }: { queueId: string | null }) {
  const { toast } = useToast()
  const { data: items, loading, reload } = useAsync<DownloadDTO[]>(
    queueId ? `/api/queues/${queueId}/items` : null,
  )

  if (!queueId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Éléments de la file</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sélectionnez une file à gauche pour voir ses éléments.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            <Users className="mr-1 inline size-4" />
            Éléments ({items?.length ?? 0})
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reload()}>
            Rafraîchir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="max-w-[24ch] truncate font-medium" title={d.filename}>
                    {d.filename}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatBytes(d.size)}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-red-600 dark:text-red-400"
                      onClick={async () => {
                        // Remove from queue: PATCH download with queueId=null
                        await fetch(`/api/downloads/${d.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ queueId: null }),
                        })
                        toast({ title: 'Retiré de la file', description: d.filename })
                        await reload()
                      }}
                      aria-label={`Retirer ${d.filename}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Cette file est vide. Ajoutez des téléchargements via le bouton Ajouter.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
