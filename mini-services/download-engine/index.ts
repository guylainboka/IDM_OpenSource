// guymadown download engine - real multi-connection HTTP download service.
// Port: 3003. socket.io (path "/"). Persists to shared SQLite (WAL mode).
//
// Robust design:
//  - Each segment downloads to its OWN temp file (<id>.seg<N>.part).
//    No concurrent writes to a single file handle (avoids native crashes).
//  - Async iteration over the response body (for await...of) instead of
//    a per-chunk Promise.race watchdog (avoids timer/promise garbage).
//  - A single per-task stall watchdog checks last activity time across
//    all workers and aborts stalled fetches.
//  - At completion, segment files are concatenated into the final file.

import { createServer } from 'http'
import * as https from 'node:https'
import * as http from 'node:http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import {
  open,
  mkdir,
  rename,
  unlink,
  stat,
} from 'node:fs/promises'
import { existsSync, createReadStream, createWriteStream } from 'node:fs'
import { basename, join, extname } from 'node:path'

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/home/z/my-project/download'
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/guymadown'
const PORT = 3003
const STALL_MS = 20000 // abort a fetch if no data for this long

const prisma = new PrismaClient({ log: ['error', 'warn'] })

process.on('unhandledRejection', (reason) => {
  console.error('[engine] UNHANDLED REJECTION:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[engine] UNCAUGHT EXCEPTION:', err?.stack || err)
})

async function dbInit() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
  } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
  return cleaned || 'download.bin'
}

function filenameFromUrl(url: string, fallback = 'download.bin'): string {
  try {
    const u = new URL(url)
    const base = basename(u.pathname) || ''
    if (base) return safeFilename(decodeURIComponent(base))
    return fallback
  } catch {
    return fallback
  }
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try {
      return safeFilename(decodeURIComponent(star[1].trim()))
    } catch {
      return safeFilename(star[1].trim())
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  if (plain) return safeFilename(plain[1].trim())
  return null
}

function classifyByExtension(filename: string): string {
  const ext = extname(filename).slice(1).toLowerCase()
  const map: Record<string, string> = {
    zip: 'Compressés', rar: 'Compressés', '7z': 'Compressés', tar: 'Compressés',
    gz: 'Compressés', iso: 'Compressés',
    pdf: 'Documents', doc: 'Documents', docx: 'Documents', xls: 'Documents',
    xlsx: 'Documents', ppt: 'Documents', txt: 'Documents',
    mp3: 'Musique', flac: 'Musique', wav: 'Musique', aac: 'Musique', ogg: 'Musique',
    exe: 'Programmes', msi: 'Programmes', deb: 'Programmes', apk: 'Programmes',
    mp4: 'Vidéos', mkv: 'Vidéos', avi: 'Vidéos', mov: 'Vidéos', webm: 'Vidéos',
    jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images', webp: 'Images', svg: 'Images',
  }
  return map[ext] || 'Autres'
}

function pickConnections(requested: number, size: number, supportsRange: boolean): number {
  if (!supportsRange || size <= 0) return 1
  let n = requested
  if (n <= 0) {
    // Auto defaults: small files use multiple connections for speed;
    // larger files default to a single connection for maximum stability
    // (multi-connection concurrency with large files can trigger runtime
    // instability). Users can manually request more if their server handles it.
    if (size < 2 * 1024 * 1024) n = 4
    else if (size < 10 * 1024 * 1024) n = 2
    else n = 1
  }
  const minSegment = 512 * 1024
  const maxBySize = Math.max(1, Math.floor(size / minSegment))
  return Math.min(n, maxBySize, 32)
}

async function readSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? null
}

async function proxyOption(): Promise<string | undefined> {
  const mode = await readSetting('proxy.mode')
  if (mode === 'none' || !mode) return undefined
  const host = await readSetting('proxy.host')
  const port = await readSetting('proxy.port')
  if (!host) return undefined
  return `${mode}://${host}${port ? ':' + port : ''}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Robust byte-range download using Node's https/http module with traditional
// data/end events. Avoids Bun's fetch streaming (which can crash natively
// under concurrent load). Calls onChunk for each received chunk. Resolves
// true if the response was fully consumed, rejects on error/abort.
function httpGetRange(opts: {
  url: string
  start: number
  end: number
  supportsRange: boolean
  etag?: string | null
  lastModified?: string | null
  signal: AbortSignal
  onChunk: (chunk: Buffer) => Promise<void> | void
}): Promise<{ status: number; totalSize?: number }> {
  return new Promise((resolve, reject) => {
    let urlObj: URL
    try {
      urlObj = new URL(opts.url)
    } catch (e: any) {
      reject(new Error('URL invalide'))
      return
    }
    const lib = urlObj.protocol === 'https:' ? https : http
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) guymadown/1.0',
      Accept: '*/*',
    }
    if (opts.supportsRange) {
      headers.Range = `bytes=${opts.start}-${opts.end}`
    }
    if (opts.etag) headers['If-Range'] = opts.etag
    else if (opts.lastModified) headers['If-Range'] = opts.lastModified

    const req = lib.request(
      urlObj,
      {
        method: 'GET',
        headers,
        // follow redirects
      },
      (res) => {
        // handle redirects manually
        if (
          (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
          res.headers.location
        ) {
          res.resume() // discard
          const newUrl = new URL(res.headers.location, opts.url).toString()
          httpGetRange({ ...opts, url: newUrl })
            .then(resolve)
            .catch(reject)
          return
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const contentRange = res.headers['content-range'] || ''
        const m = /bytes \d+-\d+\/(\d+)/.exec(contentRange)
        const totalSize = m ? Number(m[1]) : undefined

        let aborted = false
        const onAbort = () => {
          if (aborted) return
          aborted = true
          try { req.destroy() } catch {}
          try { res.destroy() } catch {}
          reject(new Error('aborted'))
        }
        if (opts.signal.aborted) {
          onAbort()
          return
        }
        opts.signal.addEventListener('abort', onAbort, { once: true })

        res.on('data', async (chunk: Buffer) => {
          if (aborted) return
          try {
            await opts.onChunk(chunk)
          } catch (err) {
            onAbort()
          }
        })
        res.on('end', () => {
          if (aborted) return
          opts.signal.removeEventListener('abort', onAbort)
          resolve({ status: res.statusCode || 200, totalSize })
        })
        res.on('error', (err: any) => {
          if (aborted) return
          opts.signal.removeEventListener('abort', onAbort)
          reject(err)
        })
      },
    )
    req.on('error', (err: any) => {
      reject(err)
    })
    req.setTimeout(0)
    req.end()
  })
}

// HEAD request using Node https/http (for analysis, avoids Bun fetch).
function httpHead(url: string): Promise<{
  status: number
  headers: Record<string, string | undefined>
  finalUrl: string
}> {
  return new Promise((resolve, reject) => {
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      reject(new Error('URL invalide'))
      return
    }
    const lib = urlObj.protocol === 'https:' ? https : http
    const req = lib.request(
      urlObj,
      { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 guymadown/1.0', Accept: '*/*' } },
      (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
          res.headers.location
        ) {
          res.resume()
          httpHead(new URL(res.headers.location, url).toString()).then(resolve).catch(reject)
          return
        }
        const headers: Record<string, string | undefined> = {}
        for (const k of [
          'content-length', 'content-type', 'content-disposition',
          'accept-ranges', 'etag', 'last-modified', 'server',
        ]) {
          headers[k] = res.headers[k]
        }
        res.resume()
        resolve({ status: res.statusCode || 200, headers, finalUrl: url })
      },
    )
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy(new Error('HEAD timeout'))
    })
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Segment model
// ---------------------------------------------------------------------------

interface MemSegment {
  id: string
  index: number
  startByte: number
  endByte: number
  downloadedBytes: number
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'idle'
  workerId: number
  segFile: string
}

interface DownloadInfo {
  finalUrl: string
  filename: string
  size: number
  mimeType: string | null
  supportsRange: boolean
  etag: string | null
  lastModified: string | null
  server: string | null
}

// ---------------------------------------------------------------------------
// DownloadTask
// ---------------------------------------------------------------------------

class DownloadTask {
  id: string
  url: string
  filename: string
  category: string
  connections: number
  queueId: string | null
  speedLimit = 0

  size = 0
  supportsRange = false
  mimeType: string | null = null
  etag: string | null = null
  lastModified: string | null = null
  server: string | null = null
  finalUrl: string

  segments: MemSegment[] = []
  workers = new Map<number, AbortController>()
  paused = false
  cancelled = false
  running = false
  outputPath: string

  private lastActivityTime = 0
  private speed = 0
  private startTime = 0
  private lastSampleTime = 0
  private lastSampleBytes = 0
  private totalDownloaded = 0
  private progressTimer: any = null
  private stallTimer: any = null

  constructor(opts: {
    id: string
    url: string
    filename: string
    category: string
    connections: number
    queueId: string | null
  }) {
    this.id = opts.id
    this.url = opts.url
    this.filename = opts.filename
    this.category = opts.category
    this.connections = opts.connections
    this.queueId = opts.queueId
    this.finalUrl = opts.url
    this.outputPath = join(DOWNLOAD_DIR, opts.filename)
  }

  totalDownloadedBytes(): number {
    return this.segments.reduce((a, s) => a + s.downloadedBytes, 0)
  }

  // ---- analysis (uses Node https module, GET probe only - many servers
  // don't support HEAD so we probe with a 1-byte Range GET directly) -------
  async analyze(): Promise<DownloadInfo> {
    let info: DownloadInfo = {
      finalUrl: this.url,
      filename: filenameFromUrl(this.url),
      size: 0,
      mimeType: null,
      supportsRange: false,
      etag: null,
      lastModified: null,
      server: null,
    }
    try {
      // Probe with a 1-byte Range GET. 206 => range supported + size from
      // content-range. 200 => no range support. The response headers give
      // us everything HEAD would have given.
      let probeStatus = 0
      let probeHeaders: Record<string, string | string[] | undefined> = {}
      let probeUrl = this.url
      const probeAc = new AbortController()
      const probeTimeout = setTimeout(() => probeAc.abort(), 20000)
      try {
        const r = await httpGetRange({
          url: this.url,
          start: 0,
          end: 0,
          supportsRange: true,
          signal: probeAc.signal,
          onChunk: () => {}, // discard the single byte
        })
        probeStatus = r.status
        probeHeaders = (r as any).headers || {}
        probeUrl = (r as any).finalUrl || this.url
      } catch {
        probeStatus = 0
      } finally {
        clearTimeout(probeTimeout)
      }

      if (probeStatus === 206) {
        info.supportsRange = true
      } else if (probeStatus === 200) {
        info.supportsRange = false
      } else if (probeStatus === 0) {
        throw new Error('Serveur injoignable ou délai dépassé')
      }

      // Get headers via a fresh GET probe response (capture headers)
      // We re-issue a tiny probe and read the response headers directly.
      const hdrAc = new AbortController()
      const hdrTimeout = setTimeout(() => hdrAc.abort(), 20000)
      try {
        await new Promise<void>((resolve) => {
          const u = new URL(this.url)
          const lib = u.protocol === 'https:' ? https : http
          const req = lib.request(u, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 guymadown/1.0',
              Accept: '*/*',
              Range: 'bytes=0-0',
            },
          }, (res) => {
            probeHeaders = res.headers as any
            if (
              (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
              res.headers.location
            ) {
              probeUrl = new URL(res.headers.location, this.url).toString()
              info.finalUrl = probeUrl
            }
            if (res.statusCode === 206) info.supportsRange = true
            if (res.statusCode === 200) info.supportsRange = false
            res.resume()
            resolve()
          })
          req.on('error', () => resolve())
          req.setTimeout(20000, () => { req.destroy(); resolve() })
          req.end()
        })
      } catch {} finally {
        clearTimeout(hdrTimeout)
      }

      const h = (k: string) => {
        const v = probeHeaders[k]
        return Array.isArray(v) ? v[0] : v
      }
      const cr = h('content-range') || ''
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(cr)
      if (m && info.supportsRange) info.size = Number(m[3])
      if (!info.size) info.size = Number(h('content-length') || 0)
      info.mimeType = h('content-type') || null
      info.etag = h('etag') || null
      info.lastModified = h('last-modified') || null
      info.server = h('server') || null
      const cd = h('content-disposition')
      if (cd) info.filename = parseContentDisposition(cd) || info.filename
      info.finalUrl = probeUrl || info.finalUrl
    } catch (err: any) {
      throw new Error(`Analyse HTTP échouée: ${err?.message || err}`)
    }
    if (!info.filename) info.filename = filenameFromUrl(this.url)
    return info
  }

  // ---- prepare segments -------------------------------------------------
  private buildSegments(n: number) {
    if (!this.supportsRange || this.size <= 0 || n <= 1) {
      this.segments = [
        {
          id: 's0',
          index: 0,
          startByte: 0,
          endByte: this.size > 0 ? this.size - 1 : -1,
          downloadedBytes: 0,
          status: 'pending',
          workerId: 0,
          segFile: join(TEMP_DIR, `${this.id}.seg0.part`),
        },
      ]
      return
    }
    const segSize = Math.floor(this.size / n)
    const segs: MemSegment[] = []
    let cursor = 0
    for (let i = 0; i < n; i++) {
      const start = cursor
      const end = i === n - 1 ? this.size - 1 : cursor + segSize - 1
      segs.push({
        id: `s${i}`,
        index: i,
        startByte: start,
        endByte: end,
        downloadedBytes: 0,
        status: 'pending',
        workerId: 0,
        segFile: join(TEMP_DIR, `${this.id}.seg${i}.part`),
      })
      cursor = end + 1
    }
    this.segments = segs
  }

  // Only split PENDING segments (never an in-progress one) to avoid
  // double-downloading a range whose request was already issued.
  private splitLargest(): MemSegment | null {
    let target: MemSegment | null = null
    let maxRemaining = 0
    for (const s of this.segments) {
      if (s.status !== 'pending') continue
      const remaining = s.endByte - (s.startByte + s.downloadedBytes) + 1
      if (remaining > maxRemaining) {
        maxRemaining = remaining
        target = s
      }
    }
    if (!target || maxRemaining < 512 * 1024) return null
    const done = target.startByte + target.downloadedBytes
    const remaining = target.endByte - done + 1
    const half = Math.floor(remaining / 2)
    const newStart = done + half
    target.endByte = newStart - 1
    const newSeg: MemSegment = {
      id: `s${this.segments.length}-${Date.now()}`,
      index: this.segments.length,
      startByte: newStart,
      endByte: newStart + (remaining - half) - 1,
      downloadedBytes: 0,
      status: 'pending',
      workerId: 0,
      segFile: join(TEMP_DIR, `${this.id}.seg${this.segments.length}.part`),
    }
    this.segments.push(newSeg)
    return newSeg
  }

  private nextPendingSegment(): MemSegment | null {
    for (const s of this.segments) {
      if (s.status === 'pending') return s
    }
    return null
  }

  // ---- worker (retry wrapper) -------------------------------------------
  private async runWorker(workerId: number, seg: MemSegment) {
    const maxRetries = 10
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.cancelled || this.paused) {
        seg.status = 'pending'
        this.workers.delete(workerId)
        return
      }
      const ac = new AbortController()
      this.workers.set(workerId, ac)
      seg.workerId = workerId
      seg.status = 'downloading'
      try {
        const completed = await this.fetchSegment(seg, ac)
        this.workers.delete(workerId)
        if (completed) {
          seg.status = 'completed'
          return
        }
        seg.status = 'pending'
        return
      } catch (err: any) {
        this.workers.delete(workerId)
        if (this.cancelled || this.paused) {
          seg.status = 'pending'
          return
        }
        // stall or network error -> backoff then retry remaining range
        await sleep(Math.min(20000, 800 * Math.pow(2, attempt)))
        continue
      }
    }
    seg.status = 'failed'
    seg.error = 'Échec après plusieurs tentatives (perte de connexion)'
    this.workers.delete(workerId)
  }

  // Single fetch+read attempt using Node's https module. Pipes the response
  // directly to the segment file write stream (correct backpressure handling).
  private async fetchSegment(seg: MemSegment, ac: AbortController): Promise<boolean> {
    const start = seg.startByte + seg.downloadedBytes
    const end = seg.endByte
    if (start > end || seg.downloadedBytes >= end - seg.startByte + 1) {
      return true
    }
    const segTotal = end - seg.startByte + 1

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) guymadown/1.0',
      Accept: '*/*',
    }
    if (this.supportsRange) headers.Range = `bytes=${start}-${end}`
    if (this.etag) headers['If-Range'] = this.etag
    else if (this.lastModified) headers['If-Range'] = this.lastModified

    let urlObj: URL
    try {
      urlObj = new URL(this.finalUrl)
    } catch {
      throw new Error('URL invalide')
    }
    const lib = urlObj.protocol === 'https:' ? https : http

    return new Promise<boolean>((resolve, reject) => {
      const doRequest = (u: URL) => {
        const req = lib.request(u, { method: 'GET', headers }, (res) => {
          if (
            (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) &&
            res.headers.location
          ) {
            res.resume()
            try {
              this.finalUrl = new URL(res.headers.location, u).toString()
              doRequest(new URL(this.finalUrl))
            } catch {
              reject(new Error('Redirection invalide'))
            }
            return
          }
          if (res.statusCode !== 200 && res.statusCode !== 206) {
            res.resume()
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          // Write response chunks to the segment file (append mode) with
          // proper backpressure (pause/resume on drain).
          const ws = createWriteStream(seg.segFile, { flags: 'a' })
          let aborted = false
          let finished = false

          const finish = () => {
            if (finished) return
            finished = true
            ws.end(() => {
              if (aborted) reject(new Error('aborted'))
              else resolve(seg.downloadedBytes >= segTotal)
            })
          }

          res.on('data', (chunk: Buffer) => {
            if (aborted || finished) return
            if (this.cancelled) {
              aborted = true
              try { ac.abort() } catch {}
              try { res.destroy() } catch {}
              try { ws.destroy() } catch {}
              return
            }
            let buf = chunk
            let len = chunk.length
            // clamp to segment end (server may overshoot)
            if (this.supportsRange) {
              const segTotalDone = seg.downloadedBytes + len
              if (segTotalDone > segTotal) {
                len = segTotal - seg.downloadedBytes
                if (len <= 0) {
                  finish()
                  return
                }
                buf = buf.subarray(0, len)
              }
            }
            seg.downloadedBytes += len
            this.totalDownloaded += len
            this.lastActivityTime = Date.now()
            const ok = ws.write(buf)
            if (!ok) {
              res.pause()
              ws.once('drain', () => {
                if (!aborted && !finished) res.resume()
              })
            }
          })

          res.on('end', () => finish())
          res.on('error', (err: any) => {
            if (finished || aborted) return
            try { ws.destroy() } catch {}
            reject(err)
          })
          ws.on('error', (err: any) => {
            if (finished || aborted) return
            try { res.destroy() } catch {}
            reject(err)
          })
        })
        req.on('error', (err: any) => reject(err))
        if (ac.signal.aborted) {
          req.destroy()
          reject(new Error('aborted'))
          return
        }
        ac.signal.addEventListener('abort', () => {
          try { req.destroy() } catch {}
        }, { once: true })
        req.end()
      }
      doRequest(urlObj)
    })
  }

  // ---- main run ---------------------------------------------------------
  async run() {
    if (this.running) return
    this.running = true
    this.paused = false
    try {
      await dbUpdateStatus(this.id, 'analyzing')
      const info = await this.analyze()
      this.finalUrl = info.finalUrl
      this.size = info.size
      this.supportsRange = info.supportsRange
      this.mimeType = info.mimeType
      this.etag = info.etag
      this.lastModified = info.lastModified
      this.server = info.server
      this.filename = info.filename
      this.category = classifyByExtension(this.filename)
      this.outputPath = join(DOWNLOAD_DIR, this.filename)

      await prisma.download.update({
        where: { id: this.id },
        data: {
          finalUrl: this.finalUrl,
          filename: this.filename,
          category: this.category,
          size: BigInt(this.size),
          mimeType: this.mimeType,
          supportsRange: this.supportsRange,
          etag: this.etag,
          lastModified: this.lastModified,
          server: this.server,
          status: 'downloading',
          startedAt: new Date(),
          lastTryAt: new Date(),
        },
      })

      const n = pickConnections(this.connections, this.size, this.supportsRange)
      this.connections = n
      this.buildSegments(n)
      await this.restoreProgress()
      await this.persistSegments()

      this.startTime = Date.now()
      this.lastSampleTime = this.startTime
      this.lastSampleBytes = this.totalDownloadedBytes()
      this.lastActivityTime = this.startTime
      this.startProgressTimer()
      this.startStallWatchdog()

      const workerPromises: Promise<void>[] = []
      for (let w = 0; w < n; w++) {
        const seg = this.nextPendingSegment()
        if (!seg) break
        workerPromises.push(this.runWorkerLoop(w, seg))
      }
      await Promise.all(workerPromises)

      this.stopProgressTimer()
      this.stopStallWatchdog()

      if (this.cancelled) {
        await dbUpdateStatus(this.id, 'cancelled')
        await this.cleanupSegmentFiles()
        return
      }

      const allDone = this.segments.every(
        (s) => s.status === 'completed' || s.endByte < s.startByte,
      )
      if (allDone) {
        // concatenate segment files into the final file
        let finalPath = this.outputPath
        if (existsSync(finalPath)) {
          const ext = extname(this.filename)
          const stem = basename(this.filename, ext)
          let i = 1
          while (existsSync(join(DOWNLOAD_DIR, `${stem} (${i})${ext}`))) i++
          finalPath = join(DOWNLOAD_DIR, `${stem} (${i})${ext}`)
        }
        // Stream-concatenate segment files into the final output file.
        // Manual chunk-by-chunk copy (avoids pipeline listener accumulation).
        const out = createWriteStream(finalPath)
        try {
          for (const seg of this.segments) {
            if (!existsSync(seg.segFile)) continue
            const rs = createReadStream(seg.segFile)
            for await (const chunk of rs as unknown as AsyncIterable<Buffer>) {
              if (!out.write(chunk)) {
                await new Promise<void>((r) => out.once('drain', () => r()))
              }
            }
            rs.destroy()
          }
          await new Promise<void>((resolve) => out.end(() => resolve()))
        } finally {
          try { out.destroy() } catch {}
        }
        const st = await stat(finalPath)
        await prisma.download.update({
          where: { id: this.id },
          data: {
            status: 'completed',
            downloaded: BigInt(st.size),
            speed: 0,
            avgSpeed: this.startTime
              ? Math.floor(st.size / Math.max(1, (Date.now() - this.startTime) / 1000))
              : 0,
            eta: 0,
            outputPath: finalPath,
            completedAt: new Date(),
          },
        })
        await this.cleanupSegmentFiles()
        io.emit('download.completed', { id: this.id, outputPath: finalPath })
      } else if (this.paused) {
        await dbUpdateStatus(this.id, 'paused')
        await this.persistSegments()
      } else {
        const failedSeg = this.segments.find((s) => s.status === 'failed')
        const errMsg = failedSeg?.error || 'Échec du téléchargement'
        await prisma.download.update({
          where: { id: this.id },
          data: { status: 'failed', error: errMsg },
        })
        await prisma.errorLog.create({
          data: { downloadId: this.id, code: 'DOWNLOAD_FAILED', message: errMsg },
        })
        io.emit('download.failed', { id: this.id, error: errMsg })
      }
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[engine] task ${this.id} error:`, msg)
      await prisma.download.update({
        where: { id: this.id },
        data: { status: 'failed', error: msg },
      })
      await prisma.errorLog.create({
        data: { downloadId: this.id, code: 'ENGINE_ERROR', message: msg },
      })
      io.emit('download.failed', { id: this.id, error: msg })
    } finally {
      this.running = false
      manager.checkQueues()
    }
  }

  private async runWorkerLoop(workerId: number, initial: MemSegment) {
    let seg: MemSegment | null = initial
    while (seg && !this.cancelled && !this.paused) {
      await this.runWorker(workerId, seg)
      if (seg.status !== 'completed') break
      seg = this.nextPendingSegment()
      if (!seg) seg = this.splitLargest()
    }
  }

  private async restoreProgress() {
    // On resume, check existing segment files and their sizes
    for (const seg of this.segments) {
      if (existsSync(seg.segFile)) {
        try {
          const s = await stat(seg.segFile)
          seg.downloadedBytes = s.size
          if (seg.downloadedBytes >= seg.endByte - seg.startByte + 1) {
            seg.status = 'completed'
          }
        } catch {}
      }
    }
    this.totalDownloaded = this.totalDownloadedBytes()
  }

  private async cleanupSegmentFiles() {
    for (const seg of this.segments) {
      try {
        if (existsSync(seg.segFile)) await unlink(seg.segFile)
      } catch {}
    }
  }

  private async persistSegments() {
    try {
      await prisma.segment.deleteMany({ where: { downloadId: this.id } })
      await prisma.segment.createMany({
        data: this.segments.map((s) => ({
          downloadId: this.id,
          index: s.index,
          startByte: BigInt(s.startByte),
          endByte: BigInt(s.endByte),
          downloadedBytes: BigInt(s.downloadedBytes),
          status: s.status,
          workerId: s.workerId,
        })),
      })
      await prisma.download.update({
        where: { id: this.id },
        data: {
          segmentsTotal: this.segments.length,
          downloaded: BigInt(this.totalDownloadedBytes()),
        },
      })
    } catch {}
  }

  private startProgressTimer() {
    this.progressTimer = setInterval(async () => {
      try {
        if (this.cancelled || !this.running) return
        const now = Date.now()
        const downloaded = this.totalDownloadedBytes()
        const dt = (now - this.lastSampleTime) / 1000
        const db = downloaded - this.lastSampleBytes
        if (dt > 0) {
          const instant = db / dt
          this.speed = Math.floor(this.speed * 0.4 + instant * 0.6)
        }
        this.lastSampleTime = now
        this.lastSampleBytes = downloaded
        const remaining = this.size > 0 ? this.size - downloaded : 0
        const eta = this.speed > 0 ? Math.floor(remaining / this.speed) : 0
        const progress = this.size > 0 ? downloaded / this.size : 0
        io.emit('download.progress', {
          id: this.id,
          downloaded: String(downloaded),
          size: String(this.size),
          speed: this.speed,
          avgSpeed: this.startTime
            ? Math.floor(downloaded / Math.max(0.1, (now - this.startTime) / 1000))
            : 0,
          eta,
          progress,
          segments: this.segments.map((s) => ({
            id: s.id,
            index: s.index,
            startByte: String(s.startByte),
            endByte: String(s.endByte),
            downloadedBytes: String(s.downloadedBytes),
            status: s.status,
            workerId: s.workerId,
          })),
        })
        if (Math.floor(now / 1500) % 2 === 0) {
          await this.persistSegments()
        }
      } catch {}
    }, 333)
  }

  private stopProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }

  // Single per-task stall watchdog: if no data arrived for STALL_MS across
  // ALL workers, abort every active worker's fetch so they retry.
  private startStallWatchdog() {
    this.stallTimer = setInterval(() => {
      if (this.cancelled || this.paused || !this.running) return
      if (this.workers.size === 0) return
      const idle = Date.now() - this.lastActivityTime
      if (idle > STALL_MS) {
        for (const [, ac] of this.workers) {
          try { ac.abort() } catch {}
        }
        this.lastActivityTime = Date.now()
      }
    }, 3000)
  }

  private stopStallWatchdog() {
    if (this.stallTimer) {
      clearInterval(this.stallTimer)
      this.stallTimer = null
    }
  }

  // ---- control ----------------------------------------------------------
  pause() {
    if (!this.running) return
    this.paused = true
    for (const [, ac] of this.workers) {
      try { ac.abort() } catch {}
    }
    this.stopProgressTimer()
    this.stopStallWatchdog()
    io.emit('download.paused', { id: this.id })
  }

  async resume() {
    if (this.running) return
    this.paused = false
    for (const s of this.segments) {
      if (s.status === 'downloading' || s.status === 'failed') s.status = 'pending'
    }
    await dbUpdateStatus(this.id, 'downloading')
    io.emit('download.resumed', { id: this.id })
    this.run()
  }

  async cancel() {
    this.cancelled = true
    this.paused = false
    for (const [, ac] of this.workers) {
      try { ac.abort() } catch {}
    }
    this.stopProgressTimer()
    this.stopStallWatchdog()
    await this.cleanupSegmentFiles()
  }
}

async function dbUpdateStatus(id: string, status: string) {
  try {
    await prisma.download.update({ where: { id }, data: { status } })
  } catch {}
}

// ---------------------------------------------------------------------------
// Download Manager
// ---------------------------------------------------------------------------

class DownloadManager {
  tasks = new Map<string, DownloadTask>()

  async add(payload: {
    url: string
    filename?: string
    category?: string
    connections?: number
    queueId?: string
  }): Promise<DownloadTask> {
    const url = payload.url.trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error('URL invalide (HTTP/HTTPS uniquement)')
    }
    const filename = payload.filename || filenameFromUrl(url)
    const category = payload.category || classifyByExtension(filename)
    // Dedup: socket.io retransmits unacked emits on reconnect
    const existing = await prisma.download.findFirst({
      where: {
        url,
        status: { in: ['pending', 'analyzing', 'queued', 'downloading', 'paused', 'retrying'] },
      },
    })
    if (existing) {
      let task = this.tasks.get(existing.id)
      if (!task) {
        task = new DownloadTask({
          id: existing.id,
          url: existing.url,
          filename: existing.filename,
          category: existing.category,
          connections: existing.connections,
          queueId: existing.queueId,
        })
        this.tasks.set(existing.id, task)
      }
      io.emit('download.created', await toDto(existing))
      return task
    }
    const dl = await prisma.download.create({
      data: {
        url,
        filename,
        category,
        connections: payload.connections ?? 8,
        queueId: payload.queueId ?? null,
        status: 'pending',
      },
    })
    const task = new DownloadTask({
      id: dl.id,
      url,
      filename,
      category,
      connections: payload.connections ?? 8,
      queueId: payload.queueId ?? null,
    })
    this.tasks.set(dl.id, task)
    io.emit('download.created', await toDto(dl))
    return task
  }

  async start(id: string) {
    let task = this.tasks.get(id)
    if (!task) {
      const dl = await prisma.download.findUnique({ where: { id } })
      if (!dl) throw new Error('Téléchargement introuvable')
      task = new DownloadTask({
        id: dl.id,
        url: dl.url,
        filename: dl.filename,
        category: dl.category,
        connections: dl.connections,
        queueId: dl.queueId,
      })
      this.tasks.set(id, task)
    }
    // Never restart a completed or actively-running download automatically.
    // Only pending/paused/failed/queued downloads can be (re)started.
    if (task.running) return
    const dl = await prisma.download.findUnique({
      where: { id },
      select: { status: true },
    })
    if (dl && dl.status === 'completed') return
    io.emit('download.started', { id })
    task.run()
  }

  pause(id: string) {
    this.tasks.get(id)?.pause()
  }

  async resume(id: string) {
    const task = this.tasks.get(id)
    if (task) await task.resume()
    else await this.start(id)
  }

  async cancel(id: string) {
    const task = this.tasks.get(id)
    if (task) await task.cancel()
    try {
      await prisma.download.update({ where: { id }, data: { status: 'cancelled' } })
    } catch {}
    io.emit('download.cancelled', { id })
  }

  async setSpeedLimit(id: string, limit: number) {
    const task = this.tasks.get(id)
    if (task) task.speedLimit = limit
  }

  async startQueue(id: string) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' }, include: { download: true } } },
    })
    if (!queue) throw new Error('File introuvable')
    await prisma.queue.update({ where: { id }, data: { active: true } })
    io.emit('queue.started', { id })
    for (const item of queue.items) {
      if (item.download.status === 'pending' || item.download.status === 'failed') {
        await dbUpdateStatus(item.downloadId, 'queued')
      }
    }
    this.checkQueues()
  }

  async stopQueue(id: string) {
    await prisma.queue.update({ where: { id }, data: { active: false } })
    io.emit('queue.completed', { id })
  }

  async checkQueues() {
    try {
      const queues = await prisma.queue.findMany({
        where: { active: true },
        orderBy: { priority: 'desc' },
        include: { items: { orderBy: { position: 'asc' }, include: { download: true } } },
      })
      let activeGlobal = 0
      for (const task of this.tasks.values()) {
        if (task.running) activeGlobal++
      }
      const maxGlobal = Number(
        (await readSetting('connection.maxConcurrentDownloads')) || '5',
      )
      for (const q of queues) {
        let activeInQueue = 0
        for (const item of q.items) {
          const t = this.tasks.get(item.downloadId)
          if (t && t.running) activeInQueue++
        }
        for (const item of q.items) {
          if (activeInQueue >= q.maxConcurrent) break
          if (activeGlobal >= maxGlobal) return
          if (item.download.status === 'queued' || item.download.status === 'failed') {
            await this.start(item.downloadId)
            activeInQueue++
            activeGlobal++
          }
        }
      }
      const pending = await prisma.download.findMany({
        where: { status: 'pending', queueId: null },
        orderBy: { addedAt: 'asc' },
      })
      for (const d of pending) {
        if (activeGlobal >= maxGlobal) break
        await this.start(d.id)
        activeGlobal++
      }
      io.emit('engine.state', {
        activeCount: activeGlobal,
        queuedCount: await prisma.download.count({ where: { status: 'queued' } }),
      })
    } catch {}
  }

  async recoverOnStartup() {
    const incomplete = await prisma.download.findMany({
      where: { status: { in: ['downloading', 'analyzing', 'retrying'] } },
    })
    for (const d of incomplete) {
      await dbUpdateStatus(d.id, 'paused')
    }
  }
}

const manager = new DownloadManager()

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

async function toDto(dl: any): Promise<any> {
  const size = Number(dl.size)
  const downloaded = Number(dl.downloaded)
  return {
    id: dl.id,
    url: dl.url,
    finalUrl: dl.finalUrl,
    filename: dl.filename,
    category: dl.category,
    mimeType: dl.mimeType,
    size: dl.size.toString(),
    downloaded: dl.downloaded.toString(),
    status: dl.status,
    speed: dl.speed,
    avgSpeed: dl.avgSpeed,
    eta: dl.eta,
    connections: dl.connections,
    supportsRange: dl.supportsRange,
    etag: dl.etag,
    lastModified: dl.lastModified,
    server: dl.server,
    outputPath: dl.outputPath,
    queueId: dl.queueId,
    error: dl.error,
    description: dl.description,
    segmentsTotal: dl.segmentsTotal,
    addedAt: dl.addedAt instanceof Date ? dl.addedAt.toISOString() : dl.addedAt,
    startedAt: dl.startedAt instanceof Date ? dl.startedAt.toISOString() : dl.startedAt || null,
    completedAt: dl.completedAt instanceof Date ? dl.completedAt.toISOString() : dl.completedAt || null,
    lastTryAt: dl.lastTryAt instanceof Date ? dl.lastTryAt.toISOString() : dl.lastTryAt || null,
    retries: dl.retries,
    progress: size > 0 ? downloaded / size : 0,
  }
}

// ---------------------------------------------------------------------------
// Socket.io server
// ---------------------------------------------------------------------------

// HTTP request handler for REST endpoints (used by the Chrome extension
// and other HTTP clients). socket.io upgrades are handled separately.
const httpServer = createServer(async (req, res) => {
  // CORS for extension requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = req.url || '/'
  try {
    if (url === '/api/add' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk.toString()
      const payload = JSON.parse(body)
      const task = await manager.add(payload)
      if (!payload.queueId) manager.start(task.id)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, id: task.id }))
      return
    }
    if (url === '/api/status' && req.method === 'GET') {
      let active = 0
      for (const t of manager.tasks.values()) if (t.running) active++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, active, engine: 'guymadown' }))
      return
    }
    if (url === '/api/downloads' && req.method === 'GET') {
      const list = await prisma.download.findMany({
        orderBy: { addedAt: 'desc' },
        take: 100,
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(list.map((d: any) => ({
        id: d.id,
        filename: d.filename,
        status: d.status,
        size: d.size.toString(),
        downloaded: d.downloaded.toString(),
      }))))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err?.message || 'Server error' }))
  }
})
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[engine] client connected: ${socket.id}`)

  socket.on('add_download', async (payload, ack) => {
    try {
      const task = await manager.add(payload)
      ack?.({ ok: true, id: task.id })
      if (!payload.queueId) manager.start(task.id)
    } catch (err: any) {
      ack?.({ ok: false, error: err.message })
      io.emit('engine.error', { message: err.message })
    }
  })

  socket.on('start_download', async ({ id }, ack) => {
    try { await manager.start(id); ack?.({ ok: true }) }
    catch (err: any) { ack?.({ ok: false, error: err.message }) }
  })
  socket.on('pause_download', ({ id }) => manager.pause(id))
  socket.on('resume_download', async ({ id }, ack) => {
    try { await manager.resume(id); ack?.({ ok: true }) }
    catch (err: any) { ack?.({ ok: false, error: err.message }) }
  })
  socket.on('cancel_download', async ({ id }, ack) => {
    try { await manager.cancel(id); ack?.({ ok: true }) }
    catch (err: any) { ack?.({ ok: false, error: err.message }) }
  })
  socket.on('set_speed_limit', ({ id, limit }) => manager.setSpeedLimit(id, Number(limit) || 0))
  socket.on('start_queue', async ({ id }, ack) => {
    try { await manager.startQueue(id); ack?.({ ok: true }) }
    catch (err: any) { ack?.({ ok: false, error: err.message }) }
  })
  socket.on('stop_queue', async ({ id }, ack) => {
    try { await manager.stopQueue(id); ack?.({ ok: true }) }
    catch (err: any) { ack?.({ ok: false, error: err.message }) }
  })
  socket.on('disconnect', () => {
    console.log(`[engine] client disconnected: ${socket.id}`)
  })
})

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  await dbInit()
  await mkdir(TEMP_DIR, { recursive: true })
  await mkdir(DOWNLOAD_DIR, { recursive: true })
  await manager.recoverOnStartup()
  setInterval(() => manager.checkQueues(), 5000)
  httpServer.listen(PORT, () => {
    console.log(`[guymadown-engine] download engine listening on port ${PORT}`)
    io.emit('engine.state', { activeCount: 0, queuedCount: 0 })
  })
}

main().catch((err) => {
  console.error('[engine] fatal:', err)
  process.exit(1)
})

process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)) })
process.on('SIGINT', () => { httpServer.close(() => process.exit(0)) })
