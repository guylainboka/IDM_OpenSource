import { PrismaClient } from '@prisma/client'
import { DEFAULT_CATEGORIES } from './types'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

async function enableWal(prisma: PrismaClient) {
  try {
    // pragmas may return values, use queryRaw to be safe
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
  } catch {
    // ignore — WAL may already be set or unavailable
  }
}

async function seedDefaults(prisma: PrismaClient) {
  const count = await prisma.category.count()
  if (count === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c, i) => ({
        name: c.name,
        color: c.color,
        extensions: c.extensions,
        position: i,
      })),
    })
  }
  const defaults: Record<string, string> = {
    'general.theme': 'system',
    'general.language': 'fr',
    'general.notifications': 'true',
    'general.startMinimized': 'false',
    'connection.maxConcurrentDownloads': '5',
    'connection.maxConnectionsPerDownload': '8',
    'connection.globalSpeedLimit': '0',
    'connection.perDownloadLimit': '0',
    'connection.maxConnectionsPerServer': '16',
    'download.confirmBeforeStart': 'true',
    'download.clipboardMonitoring': 'false',
    'download.showCompleteNotification': 'true',
    'proxy.mode': 'none',
    'proxy.host': '',
    'proxy.port': '',
    'proxy.username': '',
    'proxy.password': '',
    'security.validateTls': 'true',
    'security.blockLocal': 'true',
    'advanced.tempDir': '/tmp/guymadown',
    'advanced.logLevel': 'info',
  }
  for (const [key, value] of Object.entries(defaults)) {
    const exists = await prisma.setting.findUnique({ where: { key } })
    if (!exists) {
      await prisma.setting.create({ data: { key, value } })
    }
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

let initPromise: Promise<void> | null = null
export function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await enableWal(db)
      await seedDefaults(db)
    })()
  }
  return initPromise
}
