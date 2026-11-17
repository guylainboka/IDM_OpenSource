'use client'

import * as React from 'react'
import { Loader2, CalendarClock, Save } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import type { QueueDTO } from '@/lib/types'

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

export function SchedulerPanel() {
  const { data: queues, loading, reload } = useAsync<QueueDTO[]>('/api/queues', {
    refreshMs: 8000,
  })
  const { toast } = useToast()

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-1">
              <p className="font-medium">Planification des files d'attente</p>
              <p className="text-muted-foreground">
                Définissez des fenêtres de démarrage/arrêt pour chaque file.
                L'action de fin détermine ce qui se passe une fois tous les
                éléments terminés. Note : l'action « Éteindre » est
                principalement informative dans l'environnement web.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {(queues ?? []).map((q) => (
            <SchedulerRow key={q.id} queue={q} onSaved={reload} toast={toast} />
          ))}
          {(!queues || queues.length === 0) && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Aucune file à planifier. Créez-en une depuis le panneau Files
                d'attente.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

function SchedulerRow({
  queue,
  onSaved,
  toast,
}: {
  queue: QueueDTO
  onSaved: () => Promise<void>
  toast: (t: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
}) {
  const [startAt, setStartAt] = React.useState<string>(toLocalInput(queue.startAt))
  const [stopAt, setStopAt] = React.useState<string>(toLocalInput(queue.stopAt))
  const [endAction, setEndAction] = React.useState<string>(queue.endAction || 'none')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setStartAt(toLocalInput(queue.startAt))
    setStopAt(toLocalInput(queue.stopAt))
    setEndAction(queue.endAction || 'none')
  }, [queue])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/queues/${queue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: startAt ? new Date(startAt).toISOString() : null,
          stopAt: stopAt ? new Date(stopAt).toISOString() : null,
          endAction,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: 'Planification enregistrée', description: queue.name })
      await onSaved()
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            <span className="flex items-center gap-2">
              {queue.active && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              )}
              {queue.name}
            </span>
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {queue.itemCount} élém.
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`start-${queue.id}`}>Démarrer à</Label>
            <Input
              id={`start-${queue.id}`}
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`stop-${queue.id}`}>Arrêter à</Label>
            <Input
              id={`stop-${queue.id}`}
              type="datetime-local"
              value={stopAt}
              onChange={(e) => setStopAt(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`end-${queue.id}`}>Action de fin</Label>
          <Select value={endAction} onValueChange={setEndAction}>
            <SelectTrigger id={`end-${queue.id}`} className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              <SelectItem value="notify">Notifier uniquement</SelectItem>
              <SelectItem value="shutdown">
                Éteindre (informatif — non effectif sur le web)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}
