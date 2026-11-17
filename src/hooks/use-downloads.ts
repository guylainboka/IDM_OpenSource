'use client'

import { create } from 'zustand'
import { getEngineSocket } from '@/lib/socket'
import type { DownloadDTO, SegmentDTO } from '@/lib/types'

interface DownloadsState {
  downloads: DownloadDTO[]
  selectedId: string | null
  connected: boolean
  activeCount: number
  queuedCount: number
  loaded: boolean
  // lifecycle
  init: () => void
  fetchAll: () => Promise<void>
  setSelected: (id: string | null) => void
  // commands (emit to engine)
  addDownload: (payload: {
    url: string
    filename?: string
    category?: string
    connections?: number
    queueId?: string
  }) => Promise<{ ok: boolean; id?: string; error?: string }>
  startDownload: (id: string) => void
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
  setSpeedLimit: (id: string, limit: number) => void
  startQueue: (id: string) => void
  stopQueue: (id: string) => void
}

let initialized = false

export const useDownloads = create<DownloadsState>((set, get) => ({
  downloads: [],
  selectedId: null,
  connected: false,
  activeCount: 0,
  queuedCount: 0,
  loaded: false,

  init: () => {
    if (initialized) return
    initialized = true
    const socket = getEngineSocket()

    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', () => set({ connected: false }))

    socket.on('download.created', (d: DownloadDTO) => {
      set((s) => ({
        downloads: [d, ...s.downloads.filter((x) => x.id !== d.id)],
      }))
    })
    socket.on('download.started', ({ id }: { id: string }) => {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === id ? { ...d, status: 'downloading' } : d,
        ),
      }))
    })
    socket.on(
      'download.progress',
      (p: {
        id: string
        downloaded: string
        size: string
        speed: number
        avgSpeed: number
        eta: number
        progress: number
        segments: SegmentDTO[]
      }) => {
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === p.id
              ? {
                  ...d,
                  downloaded: p.downloaded,
                  size: p.size,
                  speed: p.speed,
                  avgSpeed: p.avgSpeed,
                  eta: p.eta,
                  progress: p.progress,
                  status: 'downloading',
                  segments: p.segments,
                }
              : d,
          ),
        }))
      },
    )
    socket.on('download.paused', ({ id }: { id: string }) => {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === id ? { ...d, status: 'paused', speed: 0 } : d,
        ),
      }))
    })
    socket.on('download.resumed', ({ id }: { id: string }) => {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === id ? { ...d, status: 'downloading' } : d,
        ),
      }))
    })
    socket.on(
      'download.completed',
      ({ id, outputPath }: { id: string; outputPath: string }) => {
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'completed',
                  speed: 0,
                  eta: 0,
                  progress: 1,
                  outputPath,
                  downloaded: d.size,
                  completedAt: new Date().toISOString(),
                }
              : d,
          ),
        }))
      },
    )
    socket.on(
      'download.failed',
      ({ id, error }: { id: string; error: string }) => {
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === id ? { ...d, status: 'failed', error, speed: 0 } : d,
          ),
        }))
      },
    )
    socket.on('download.cancelled', ({ id }: { id: string }) => {
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === id ? { ...d, status: 'cancelled', speed: 0 } : d,
        ),
      }))
    })
    socket.on('engine.state', ({ activeCount, queuedCount }) => {
      set({ activeCount, queuedCount })
    })

    get().fetchAll()
  },

  fetchAll: async () => {
    try {
      const res = await fetch('/api/downloads?limit=1000')
      const data = (await res.json()) as DownloadDTO[]
      set({ downloads: data, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setSelected: (id) => set({ selectedId: id }),

  addDownload: (payload) =>
    new Promise((resolve) => {
      const socket = getEngineSocket()
      socket.emit('add_download', payload, (ack: { ok: boolean; id?: string; error?: string }) => {
        resolve(ack)
      })
    }),

  startDownload: (id) => {
    getEngineSocket().emit('start_download', { id })
  },
  pauseDownload: (id) => {
    getEngineSocket().emit('pause_download', { id })
  },
  resumeDownload: (id) => {
    getEngineSocket().emit('resume_download', { id })
  },
  cancelDownload: (id) => {
    getEngineSocket().emit('cancel_download', { id })
  },
  setSpeedLimit: (id, limit) => {
    getEngineSocket().emit('set_speed_limit', { id, limit })
  },
  startQueue: (id) => {
    getEngineSocket().emit('start_queue', { id })
  },
  stopQueue: (id) => {
    getEngineSocket().emit('stop_queue', { id })
  },
}))

// helpers
export function selectDownload(id: string | null) {
  return useDownloads.getState().downloads.find((d) => d.id === id) || null
}
