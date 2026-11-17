'use client'

import * as React from 'react'
import { Download, Trash2, FileText, Loader2, RefreshCw } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import { formatBytes } from '@/lib/types'
import { useDownloads } from '@/hooks/use-downloads'

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

interface FileEntry {
  id: string
  filename: string
  category: string
  size: number | string
  outputPath: string | null
  completedAt: string
  mimeType: string | null
  exists: boolean
  base: string
}

export function FilesPanel() {
  const { data: files, loading, reload } = useAsync<FileEntry[]>('/api/files?completed=true')
  const { toast } = useToast()
  const fetchAll = useDownloads((s) => s.fetchAll)

  const del = async (id: string, filename: string) => {
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' })
      await fetchAll()
      toast({ title: 'Fichier supprimé', description: filename })
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
          <h3 className="text-sm font-semibold">
            Fichiers téléchargés ({files?.length ?? 0})
          </h3>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => reload()}>
            <RefreshCw className="size-3.5" /> Rafraîchir
          </Button>
        </div>

        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : files && files.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="max-w-[28ch]">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium" title={f.filename}>
                          {f.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {f.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatBytes(f.size)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(f.completedAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      {f.exists ? (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          Disponible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">
                          Manquant
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {f.exists ? (
                          <Button asChild size="sm" variant="ghost" className="size-7">
                            <a href={`/api/files/${f.id}`} download aria-label={`Télécharger ${f.filename}`}>
                              <Download className="size-3.5" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7"
                            disabled
                            aria-label="Fichier indisponible"
                          >
                            <Loader2 className="size-3.5 opacity-30" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 text-red-600 dark:text-red-400"
                              aria-label={`Supprimer ${f.filename}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer « {f.filename} » ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Le fichier sur disque sera supprimé. L'entrée
                                restera dans l'historique des téléchargements.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => del(f.id, f.filename)}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun fichier terminé. Les téléchargements complétés apparaîtront ici.
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
