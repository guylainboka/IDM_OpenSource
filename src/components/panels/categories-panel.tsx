'use client'

import * as React from 'react'
import { Plus, Trash2, Loader2, Palette } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'
import type { CategoryDTO } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const COLOR_PRESETS = [
  '#10b981', '#06b6d4', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#64748b', '#84cc16',
]

export function CategoriesPanel() {
  const { data: categories, loading, reload } = useAsync<CategoryDTO[]>('/api/categories')
  const { toast } = useToast()

  const [newName, setNewName] = React.useState('')
  const [newColor, setNewColor] = React.useState(COLOR_PRESETS[0])
  const [newExt, setNewExt] = React.useState('')
  const [newDest, setNewDest] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          extensions: newExt.trim(),
          destination: newDest.trim() || null,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Échec de création')
      }
      toast({ title: 'Catégorie créée', description: newName })
      setNewName('')
      setNewExt('')
      setNewDest('')
      setNewColor(COLOR_PRESETS[0])
      await reload()
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

  const deleteCategory = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Échec de suppression')
      toast({ title: 'Catégorie supprimée', description: name })
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
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Add form */}
        <form
          onSubmit={createCategory}
          className="rounded-lg border bg-card p-4"
        >
          <h3 className="mb-3 text-sm font-semibold">Nouvelle catégorie</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nom</Label>
              <Input
                id="cat-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Compressés"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-ext">Extensions (séparées par virgule)</Label>
              <Input
                id="cat-ext"
                value={newExt}
                onChange={(e) => setNewExt(e.target.value)}
                placeholder="zip,rar,7z"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-dest">Dossier de destination</Label>
              <Input
                id="cat-dest"
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
                placeholder="/downloads/archives"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`size-6 rounded-full border-2 ${
                      newColor === c ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
                <div className="relative">
                  <Palette className="absolute left-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Couleur personnalisée"
                  />
                </div>
              </div>
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

        {/* List */}
        <div className="rounded-lg border">
          <div className="border-b p-3">
            <h3 className="text-sm font-semibold">
              Catégories existantes ({categories?.length ?? 0})
            </h3>
          </div>
          {loading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Couleur</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Extensions</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="w-16 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories ?? []).map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <span
                        className="inline-block size-4 rounded-full"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {cat.extensions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          cat.extensions.map((ext) => (
                            <Badge
                              key={ext}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              .{ext}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cat.destination || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-red-600 dark:text-red-400"
                            aria-label={`Supprimer ${cat.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Supprimer « {cat.name} » ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Les téléchargements existants garderont leur
                              catégorie mais ne seront plus groupés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategory(cat.id, cat.name)}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(!categories || categories.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucune catégorie. Créez-en une ci-dessus.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
