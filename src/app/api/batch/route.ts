import { NextRequest } from 'next/server'
import { json, errorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Generate URLs from patterns like:
//   https://example.com/file_[001-150].zip
//   https://example.com/pic_[a-f].png
// Also parses raw lists (newline / comma separated).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const input: string = (body.input || '').trim()
  if (!input) return errorResponse('Entrée vide', 400)

  const urls: string[] = []

  // detect sequence pattern
  const seq = /\[(-?\d+)-(-?\d+)\]/.exec(input)
  if (seq) {
    const start = Number(seq[1])
    const end = Number(seq[2])
    if (start > end) return errorResponse('Séquence invalide', 400)
    // detect zero padding from the first number length
    const padLen = seq[1].replace('-', '').length
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    const step = start <= end ? 1 : -1
    const max = Math.abs(hi - lo) + 1
    if (max > 5000) return errorResponse('Trop de générations (>5000)', 400)
    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      const token = String(i).padStart(padLen, '0')
      urls.push(input.replace(seq[0], token))
    }
    return json({ source: 'sequence', count: urls.length, urls })
  }

  // alpha sequence [a-f]
  const alpha = /\[([a-z])-([a-z])\]/i.exec(input)
  if (alpha) {
    const a = alpha[1].charCodeAt(0)
    const b = alpha[2].charCodeAt(0)
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    for (let c = lo; c <= hi; c++) {
      urls.push(input.replace(alpha[0], String.fromCharCode(c)))
    }
    return json({ source: 'alpha', count: urls.length, urls })
  }

  // otherwise treat as raw list (newline, comma, semicolon separated)
  const parts = input.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean)
  for (const p of parts) {
    if (/^https?:\/\//i.test(p)) urls.push(p)
  }
  return json({ source: 'list', count: urls.length, urls })
}
