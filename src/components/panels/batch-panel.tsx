'use client'

import * as React from 'react'
import { Loader2, Wand2, Plus, ListPlus } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import type { QueueDTO } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BatchResult {
  source: string
  count: number
  urls: string[]
}

interface BatchAddResult {
  created: number
  skipped: number
  createdIds: string[]
}

export function BatchPanel() {
  const { toast } = useToast()
  const { data: queues } = useAsync<QueueDTO[]>('/api/queues')

  const [input, setInput] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [result, setResult] = React.useState<BatchResult | null>(null)
  const [queueId, setQueueId] = React.useState<string>('none')
  const [connections, setConnections] = React.useState<string>('8')
  const [adding, setAdding] = React.useState(false)

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as BatchResult
      setResult(data)
      if (data.count === 0) {
        toast({ title: 'Aucune URL générée', description: 'Vérifiez votre saisie.' })
      }
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const addAll = async () => {
    if (!result || result.urls.length === 0) return
    setAdding(true)
    try {
      const res = await fetch('/api/batch/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: result.urls,
          queueId: queueId === 'none' ? null : queueId,
          connections: Number(connections),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as BatchAddResult
      toast({
        title: 'Lot ajouté',
        description: `${data.created} créé(s), ${data.skipped} ignoré(s) (doublons).`,
      })
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        {/* Input form */}
        <form onSubmit={generate} className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            Téléchargement par lots
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="batch-input">URLs ou motif de séquence</Label>
            <Textarea
              id="batch-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`https://exemple.com/file_[001-150].zip
ou une liste (une URL par ligne):
https://exemple.com/a.pdf
https://exemple.com/b.pdf`}
              className="min-h-32 font-mono text-xs"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Plus className="size-3.5" />
            <span>
              Motifs supportés: <code>[001-150]</code>, <code>[a-f]</code>, listes
              séparées par virgule, point-virgule ou retour ligne.
            </span>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={generating || !input.trim()} className="gap-2">
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Générer
            </Button>
          </div>
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-3 rounded-lg border">
            <div className="border-b p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {result.source}
                  </Badge>
                  <span className="text-sm font-medium">
                    {result.count} URL(s) générée(s)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="batch-queue" className="text-[10px]">
                      File
                    </Label>
                    <Select value={queueId} onValueChange={setQueueId}>
                      <SelectTrigger id="batch-queue" className="h-8 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {(queues ?? []).map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="batch-conn" className="text-[10px]">
                      Connexions
                    </Label>
                    <Select value={connections} onValueChange={setConnections}>
                      <SelectTrigger id="batch-conn" className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 4, 8, 16, 32].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={addAll}
                    disabled={adding || result.urls.length === 0}
                    className="mt-4 gap-1.5"
                  >
                    {adding ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ListPlus className="size-3.5" />
                    )}
                    Ajouter au téléchargement
                  </Button>
                </div>
              </div>
            </div>
            <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin rounded-md border">
              {result.urls.map((u, i) => (
                <li key={`${u}-${i}`} className="px-3 py-1.5 font-mono text-xs">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
