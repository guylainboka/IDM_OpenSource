import { NextRequest } from 'next/server'
import { json, errorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

interface FoundResource {
  url: string
  type: 'page' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'script' | 'style' | 'other'
  filename: string
  extension: string
  size: number | null
}

function classifyExt(ext: string): FoundResource['type'] {
  const e = ext.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(e)) return 'image'
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'].includes(e)) return 'video'
  if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'].includes(e)) return 'audio'
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(e)) return 'document'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(e)) return 'archive'
  if (['js', 'mjs'].includes(e)) return 'script'
  if (['css'].includes(e)) return 'style'
  if (['html', 'htm'].includes(e)) return 'page'
  return 'other'
}

function extFromUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    const path = u.pathname
    const m = /\.([a-zA-Z0-9]{1,8})$/.exec(path)
    return m ? m[1].toLowerCase() : ''
  } catch {
    return ''
  }
}

function basenameUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    const b = u.pathname.split('/').filter(Boolean).pop()
    return b ? decodeURIComponent(b) : u.hostname
  } catch {
    return urlStr.split('/').pop() || 'resource'
  }
}

function absUrl(base: string, href: string): string | null {
  if (!href) return null
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const url = body.url
  if (!url || !/^https?:\/\//i.test(url)) {
    return errorResponse('URL invalide', 400)
  }
  const filterExt = body.extensions
    ? String(body.extensions)
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
    : null

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) guymadown-grabber/1.0',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return errorResponse(`Erreur HTTP ${res.status} lors du crawl`, 502)
    }
    const html = await res.text()
    const base = res.url || url

    const resources = new Map<string, FoundResource>()

    const addRes = (href: string | null) => {
      if (!href) return
      const abs = absUrl(base, href)
      if (!abs) return
      // only http(s)
      if (!/^https?:\/\//i.test(abs)) return
      if (resources.has(abs)) return
      const ext = extFromUrl(abs)
      const type = ext ? classifyExt(ext) : 'page'
      resources.set(abs, {
        url: abs,
        type,
        filename: basenameUrl(abs),
        extension: ext,
        size: null,
      })
    }

    // extract from common attributes via regex (no DOM parser server-side lightweight)
    // <a href>, <img src>, <video src>, <audio src>, <source src>, <link href>, <script src>
    const patterns = [
      /<a\s[^>]*href=["']([^"']+)["']/gi,
      /<img\s[^>]*src=["']([^"']+)["']/gi,
      /<video\s[^>]*src=["']([^"']+)["']/gi,
      /<audio\s[^>]*src=["']([^"']+)["']/gi,
      /<source\s[^>]*src=["']([^"']+)["']/gi,
      /<link\s[^>]*href=["']([^"']+)["']/gi,
      /<script\s[^>]*src=["']([^"']+)["']/gi,
      /<embed\s[^>]*src=["']([^"']+)["']/gi,
      /<object\s[^>]*data=["']([^"']+)["']/gi,
    ]
    for (const p of patterns) {
      let m: RegExpExecArray | null
      while ((m = p.exec(html)) !== null) {
        addRes(m[1])
      }
    }

    let list = Array.from(resources.values())
    if (filterExt && filterExt.length > 0) {
      list = list.filter((r) => filterExt.includes(r.extension))
    }

    return json({
      url: base,
      title: /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null,
      resourceCount: list.length,
      resources: list,
    })
  } catch (err: any) {
    return errorResponse(`Échec du crawl: ${err?.message || err}`, 502)
  }
}
