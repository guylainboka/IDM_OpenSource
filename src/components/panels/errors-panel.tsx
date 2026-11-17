'use client'

import * as React from 'react'
import { AlertTriangle, Trash2, RefreshCw, Loader2 } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import type { ErrorLogDTO } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

export function ErrorsPanel() {
  const { data: errors, loading, reload } = useAsync<ErrorLogDTO[]>('/api/errors?limit=500')
  const { toast } = useToast()

  const clearAll = async () => {
    try {
      await fetch('/api/errors', { method: 'DELETE' })
      toast({ title: 'Journal effacé' })
      await reload()
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-5xl space-y-3 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            Journal d'erreurs ({errors?.length ?? 0})
          </h3>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => reload()}>
              <RefreshCw className="size-3.5" /> Rafraîchir
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-600 dark:text-red-400"
                  disabled={!errors || errors.length === 0}
                >
                  <Trash2 className="size-3.5" /> Tout effacer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Effacer tout le journal ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprime tous les enregistrements d'erreurs.
                    Action irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAll}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Effacer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : errors && errors.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-44">Téléchargement</TableHead>
                  <TableHead className="w-40">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] text-red-700 dark:text-red-300">
                        {e.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-xs">
                      <span className="break-all">{e.message}</span>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {e.downloadId ? (
                        <a
                          href={`/api/downloads/${e.downloadId}`}
                          className="hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {e.downloadId.slice(0, 8)}…
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {new Date(e.timestamp).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-6 opacity-0" aria-hidden />
            Aucune erreur enregistrée. Tout va bien.
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
