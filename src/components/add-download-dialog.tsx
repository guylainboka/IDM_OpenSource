'use client'

import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'

import { useDownloads } from '@/hooks/use-downloads'
import { useUI } from '@/hooks/use-ui'
import { useToast } from '@/hooks/use-toast'
import { useAsync } from '@/hooks/use-async'
import { classifyByExtension } from '@/lib/types'
import type { CategoryDTO, QueueDTO } from '@/lib/types'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AddDownloadDialog() {
  const open = useUI((s) => s.panel === 'add')
  const setPanel = useUI((s) => s.setPanel)
  const { toast } = useToast()
  const addDownload = useDownloads((s) => s.addDownload)

  const { data: categories } = useAsync<CategoryDTO[]>('/api/categories', {
    enabled: open,
  })
  const { data: queues } = useAsync<QueueDTO[]>('/api/queues', {
    enabled: open,
  })

  const [url, setUrl] = React.useState('')
  const [filename, setFilename] = React.useState('')
  const [category, setCategory] = React.useState<string>('auto')
  const [connections, setConnections] = React.useState<string>('8')
  const [queueId, setQueueId] = React.useState<string>('none')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setUrl('')
      setFilename('')
      setCategory('auto')
      setConnections('8')
      setQueueId('none')
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  const detectedCategory = React.useMemo(() => {
    const name = filename || url.split('/').pop() || url
    return classifyByExtension(name)
  }, [filename, url])

  const finalCategory = category === 'auto' ? detectedCategory : category

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("L'URL doit commencer par http:// ou https://")
      return
    }
    setSubmitting(true)
    try {
      const result = await addDownload({
        url: trimmed,
        filename: filename.trim() || undefined,
        category: finalCategory,
        connections: connections === 'auto' ? 0 : Number(connections),
        queueId: queueId === 'none' ? undefined : queueId,
      })
      if (!result.ok) {
        setError(result.error || "Échec de l'envoi au moteur")
        return
      }
      toast({
        title: 'Téléchargement ajouté',
        description: `${filename || trimmed.split('/').pop() || trimmed} — démarrage en cours.`,
      })
      setPanel('add') // toggles to none
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setPanel('add')}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un téléchargement</DialogTitle>
          <DialogDescription>
            Saisissez une URL HTTP(S). Le moteur analysera la ressource et
            démarrera le téléchargement immédiatement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-url">URL</Label>
            <Input
              id="add-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com/fichier.zip"
              autoFocus
              aria-invalid={!!error}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-filename">Nom du fichier</Label>
            <Input
              id="add-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Laisser vide pour auto-détection"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-category">Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="add-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto ({detectedCategory})
                  </SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {category === 'auto' && (
                <p className="text-[11px] text-muted-foreground">
                  Classé dans « {detectedCategory} » d'après l'extension.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-connections">Connexions</Label>
              <Select value={connections} onValueChange={setConnections}>
                <SelectTrigger id="add-connections" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '4', '8', '16', '32', 'auto'].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n === 'auto' ? 'Auto' : n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-queue">File d'attente</Label>
            <Select value={queueId} onValueChange={setQueueId}>
              <SelectTrigger id="add-queue" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune (démarrage immédiat)</SelectItem>
                {(queues ?? []).map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPanel('add')}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Ajouter et démarrer
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Catégorie: {finalCategory} · Connexions: {connections}
              </TooltipContent>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
