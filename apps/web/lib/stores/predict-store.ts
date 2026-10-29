import { create } from 'zustand'

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
  /** Drop the remembered sandbox (called on logout, together with the purge). */
  forget: () => void
}

// The last prediction the student had open — a single in-memory slot, so it
// survives route navigation (a misclick to Настройки keeps the configuration)
// but intentionally nothing beyond the current session: no localStorage, and
// the logout handler calls forget() so the next session starts empty.
export const usePredictStore = create<PredictSandboxState>()((set) => ({
  last: null,
  remember: (last) => set({ last }),
  forget: () => set({ last: null }),
}))
