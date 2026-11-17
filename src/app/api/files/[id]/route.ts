import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDbReady } from '@/lib/db'
import { errorResponse } from '@/lib/api-helpers'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'

export const dynamic = 'force-dynamic'

// Stream a completed downloaded file back to the browser.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbReady()
  const { id } = await params
  const dl = await db.download.findUnique({ where: { id } })
  if (!dl || !dl.outputPath || !existsSync(dl.outputPath)) {
    return errorResponse('Fichier introuvable', 404)
  }
  const buf = await readFile(dl.outputPath)
  const filename = basename(dl.outputPath)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': dl.mimeType || 'application/octet-stream',
      'Content-Length': String(buf.length),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbReady()
  const { id } = await params
  const dl = await db.download.findUnique({ where: { id } })
  if (dl?.outputPath && existsSync(dl.outputPath)) {
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(dl.outputPath)
    } catch {}
  }
  return NextResponse.json({ ok: true })
}
