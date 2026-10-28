import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MIN_PERCENT = 0
export const MAX_PERCENT = 100
export const FULL_PERCENT_RANGE: [number, number] = [MIN_PERCENT, MAX_PERCENT]

export type JournalSortKey = 'score-asc' | 'score-desc' | 'alpha'

type JournalViewState = {
  sort: JournalSortKey
  onlyMarked: boolean
  percentRange: [number, number]
}

type JournalViewActions = {
  setSort: (sort: JournalSortKey) => void
  setOnlyMarked: (onlyMarked: boolean) => void
  setPercentRange: (range: [number, number]) => void
  resetView: () => void
}

const DEFAULT_VIEW: JournalViewState = {
  sort: 'alpha',
  onlyMarked: false,
  percentRange: FULL_PERCENT_RANGE,
}

// Journal toolbar state (sorting and filtering). Persisted so returning to
// the page keeps the last arrangement; the active quarter stays in the URL.
export const useJournalStore = create<JournalViewState & JournalViewActions>()(
  persist(
    (set) => ({
      ...DEFAULT_VIEW,
      setSort: (sort) => set({ sort }),
      setOnlyMarked: (onlyMarked) => set({ onlyMarked }),
      setPercentRange: (percentRange) => set({ percentRange }),
      resetView: () => set(DEFAULT_VIEW),
    }),
    { name: 'journal' },
  ),
)
