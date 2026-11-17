'use client'

import * as React from 'react'
import { Save, Loader2, RotateCcw } from 'lucide-react'

import { useAsync } from '@/hooks/use-async'
import { useToast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface SettingSection {
  title: string
  description?: string
  fields: SettingField[]
}

interface SettingField {
  key: string
  label: string
  type: 'text' | 'number' | 'switch' | 'select' | 'slider'
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  unit?: string
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Général',
    fields: [
      { key: 'general.theme', label: 'Thème', type: 'select', options: [
        { value: 'system', label: 'Système' },
        { value: 'light', label: 'Clair' },
        { value: 'dark', label: 'Sombre' },
      ] },
      { key: 'general.language', label: 'Langue', type: 'select', options: [
        { value: 'fr', label: 'Français' },
        { value: 'en', label: 'English' },
      ] },
      { key: 'general.notifications', label: 'Notifications système', type: 'switch' },
      { key: 'general.startMinimized', label: 'Démarrer minimisé', type: 'switch' },
    ],
  },
  {
    title: 'Connexion',
    description: 'Paramètres réseau globaux et par téléchargement.',
    fields: [
      { key: 'connection.maxConcurrentDownloads', label: 'Téléchargements simultanés max', type: 'slider', min: 1, max: 20, step: 1 },
      { key: 'connection.maxConnectionsPerDownload', label: 'Connexions par téléchargement', type: 'slider', min: 1, max: 32, step: 1 },
      { key: 'connection.globalSpeedLimit', label: 'Limite globale (KB/s)', type: 'number', placeholder: '0 = illimité' },
      { key: 'connection.perDownloadLimit', label: 'Limite par téléchargement (KB/s)', type: 'number', placeholder: '0 = illimité' },
      { key: 'connection.maxConnectionsPerServer', label: 'Connexions max par serveur', type: 'slider', min: 1, max: 32, step: 1 },
    ],
  },
  {
    title: 'Téléchargements',
    fields: [
      { key: 'download.confirmBeforeStart', label: 'Confirmer avant de démarrer', type: 'switch' },
      { key: 'download.clipboardMonitoring', label: 'Surveillance du presse-papier', type: 'switch' },
      { key: 'download.showCompleteNotification', label: 'Notification en fin de téléchargement', type: 'switch' },
    ],
  },
  {
    title: 'Proxy',
    fields: [
      { key: 'proxy.mode', label: 'Mode', type: 'select', options: [
        { value: 'none', label: 'Aucun' },
        { value: 'http', label: 'HTTP' },
        { value: 'https', label: 'HTTPS' },
        { value: 'socks4', label: 'SOCKS4' },
        { value: 'socks5', label: 'SOCKS5' },
      ] },
      { key: 'proxy.host', label: 'Hôte', type: 'text', placeholder: 'proxy.exemple.com' },
      { key: 'proxy.port', label: 'Port', type: 'number', placeholder: '8080' },
      { key: 'proxy.username', label: 'Identifiant', type: 'text' },
      { key: 'proxy.password', label: 'Mot de passe', type: 'text', placeholder: '••••••••' },
    ],
  },
  {
    title: 'Sécurité',
    fields: [
      { key: 'security.validateTls', label: 'Valider les certificats TLS', type: 'switch' },
      { key: 'security.blockLocal', label: 'Bloquer les adresses locales (loopback/privées)', type: 'switch' },
    ],
  },
  {
    title: 'Avancé',
    fields: [
      { key: 'advanced.tempDir', label: 'Dossier temporaire', type: 'text', placeholder: '/tmp/guymadown' },
      { key: 'advanced.logLevel', label: 'Niveau de log', type: 'select', options: [
        { value: 'error', label: 'Erreur' },
        { value: 'warn', label: 'Avertissement' },
        { value: 'info', label: 'Information' },
        { value: 'debug', label: 'Débogage' },
      ] },
    ],
  },
]

export function SettingsPanel() {
  const { data: settings, loading, reload } = useAsync<Record<string, string>>('/api/settings')
  const { toast } = useToast()

  // local working copy
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (settings) setDraft({ ...settings })
  }, [settings])

  const dirty = React.useMemo(() => {
    if (!settings) return false
    for (const k of allKeys()) {
      if ((draft[k] ?? '') !== (settings[k] ?? '')) return true
    }
    return false
  }, [draft, settings])

  const update = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const diff: Record<string, string> = {}
      for (const k of allKeys()) {
        if ((draft[k] ?? '') !== (settings?.[k] ?? '')) {
          diff[k] = draft[k] ?? ''
        }
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: 'Options enregistrées', description: `${Object.keys(diff).length} modification(s).` })
      await reload()
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

  const reset = () => {
    if (settings) setDraft({ ...settings })
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        {SECTIONS.map((section, idx) => (
          <section key={section.title} className="rounded-lg border bg-card">
            <header className="border-b p-3">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              {section.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p>
              )}
            </header>
            <div className="divide-y">
              {section.fields.map((field) => (
                <SettingRow
                  key={field.key}
                  field={field}
                  value={draft[field.key] ?? ''}
                  onChange={(v) => update(field.key, v)}
                />
              ))}
            </div>
            {idx < SECTIONS.length - 1 && <Separator className="hidden" />}
          </section>
        ))}

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 p-3 backdrop-blur">
          <Button variant="outline" onClick={reset} disabled={!dirty || saving} className="gap-2">
            <RotateCcw className="size-4" /> Annuler
          </Button>
          <Button onClick={save} disabled={!dirty || saving} className="gap-2">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}

function SettingRow({
  field,
  value,
  onChange,
}: {
  field: SettingField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <Label htmlFor={field.key} className="flex-1 text-sm font-normal">
        {field.label}
      </Label>
      <div className="flex items-center gap-2">
        {field.type === 'switch' && (
          <Switch
            id={field.key}
            checked={value === 'true' || value === '1'}
            onCheckedChange={(c) => onChange(c ? 'true' : 'false')}
          />
        )}
        {field.type === 'text' && (
          <Input
            id={field.key}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-56"
          />
        )}
        {field.type === 'number' && (
          <Input
            id={field.key}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-32"
          />
        )}
        {field.type === 'select' && (
          <Select value={value || field.options?.[0]?.value || ''} onValueChange={onChange}>
            <SelectTrigger id={field.key} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {field.type === 'slider' && (
          <div className="flex items-center gap-2">
            <Slider
              min={field.min}
              max={field.max}
              step={field.step}
              value={[Number(value || field.min || 0)]}
              onValueChange={(v) => onChange(String(v[0] ?? 0))}
              className="w-32"
            />
            <span className="w-8 text-right font-mono text-xs">
              {value || field.min || 0}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function allKeys(): string[] {
  return SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
}
