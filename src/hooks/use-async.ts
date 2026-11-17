'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setData: (data: T | null) => void
}

/**
 * Lightweight data-fetching hook (no QueryClient needed).
 * Fetches a JSON resource via GET and exposes data/loading/error/reload.
 *
 * Pass `enabled: false` to skip the fetch (e.g. for panels that are not
 * currently active). Pass `jsonBody` to make it a POST with that body.
 */
export function useAsync<T = unknown>(
  url: string | null,
  options?: {
    enabled?: boolean
    method?: 'GET' | 'POST'
    jsonBody?: unknown
    refreshMs?: number
  },
): AsyncState<T> {
  const enabled = options?.enabled ?? true
  const method = options?.method ?? 'GET'
  const jsonBody = options?.jsonBody
  const refreshMs = options?.refreshMs

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<string | null>(null)

  // Keep latest body in a ref so we don't refetch when the parent re-renders
  // with the same body string.
  const bodyRef = useRef(jsonBody)
  bodyRef.current = jsonBody

  const reload = useCallback(async () => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const init: RequestInit = { method }
      if (method === 'POST') {
        init.headers = { 'Content-Type': 'application/json' }
        init.body = JSON.stringify(bodyRef.current ?? {})
      }
      const res = await fetch(url, init)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as T
      setData(json)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [url, method])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void reload()
  }, [reload, enabled])

  useEffect(() => {
    if (!refreshMs || !enabled) return
    const id = setInterval(() => void reload(), refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, enabled, reload])

  return { data, loading, error, reload, setData }
}
