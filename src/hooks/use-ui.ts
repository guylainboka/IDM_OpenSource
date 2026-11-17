'use client'

import { create } from 'zustand'

export type SidebarView =
  | 'all'
  | 'incomplete'
  | 'completed'
  | 'failed'
  | { type: 'category'; name: string }
  | { type: 'queue'; id: string; name: string }
  | { type: 'grabber' }

export type Panel =
  | 'none'
  | 'categories'
  | 'queues'
  | 'scheduler'
  | 'settings'
  | 'grabber'
  | 'batch'
  | 'files'
  | 'errors'
  | 'add'
  | 'stats'

interface UIState {
  view: SidebarView
  search: string
  panel: Panel
  detailId: string | null
  selectedIds: string[]
  setView: (v: SidebarView) => void
  setSearch: (s: string) => void
  setPanel: (p: Panel) => void
  setDetailId: (id: string | null) => void
  setSelectedIds: (ids: string[]) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void
}

export const useUI = create<UIState>((set) => ({
  view: 'all',
  search: '',
  panel: 'none',
  detailId: null,
  selectedIds: [],
  setView: (view) => set({ view }),
  setSearch: (search) => set({ search }),
  setPanel: (panel) => set({ panel: panel === useUI.getState().panel ? 'none' : panel }),
  setDetailId: (detailId) => set({ detailId }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelected: () => set({ selectedIds: [] }),
}))
