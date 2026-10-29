import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// One editable rubric row of the prediction sandbox (structurally mirrors the
// calculator's entry shape: title editable for custom rows, mark/max always).
export type PredictEntry = {
  key: string
  title: string
  mark: string
  max: string
  custom: boolean
}

export type LastPrediction = {
  quarter: string
  subjectId: string
  chapterEntries: PredictEntry[]
  quarterEntries: PredictEntry[]
}

type PredictSandboxState = {
  last: LastPrediction | null
  /** Overwrite the remembered sandbox with the calculator's current state. */
  remember: (last: LastPrediction) => void
  /** Drop the remembered sandbox (e.g. when its subject no longer exists). */
  forget: () => void
}

// The last sandbox the student actually edited — a single slot, overwritten
// on every edit. Persisted so leaving the page (or the app) and coming back
// restores it. Cleared on logout together with the other local data.
export const usePredictStore = create<PredictSandboxState>()(
  persist(
    (set) => ({
      last: null,
      remember: (last) => set({ last }),
      forget: () => set({ last: null }),
    }),
    { name: 'predict' },
  ),
)
