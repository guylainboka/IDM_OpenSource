import { NextResponse } from 'next/server'
import { ensureDbReady } from './db'

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function withDb<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    await ensureDbReady()
    return await fn()
  } catch (err: any) {
    const message = err?.message || 'Erreur serveur'
    const status = /introuvable/i.test(message) ? 404 : 500
    return errorResponse(message, status)
  }
}

// BigInt-safe JSON serialization helper
export function bigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (Array.isArray(obj)) return obj.map(bigIntToNumber)
  if (typeof obj === 'object') {
    const out: any = {}
    for (const k of Object.keys(obj)) out[k] = bigIntToNumber(obj[k])
    return out
  }
  return obj
}

export function bigIntToString(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return obj.toString()
  if (Array.isArray(obj)) return obj.map(bigIntToString)
  if (typeof obj === 'object') {
    const out: any = {}
    for (const k of Object.keys(obj)) out[k] = bigIntToString(obj[k])
    return out
  }
  return obj
}
