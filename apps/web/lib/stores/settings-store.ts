import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Default color band boundaries for the current-score percentage: red below
// redOrange, orange from redOrange to orangeGreen, green at orangeGreen and up.
export const DEFAULT_THRESHOLDS = {
  redOrange: 65,
  orangeGreen: 85,
} as const

type GradeSettingsState = {
  /** Percentage from which the current score turns orange instead of red. */
  redOrangeThreshold: number
  /** Percentage from which the current score turns green instead of orange. */
  orangeGreenThreshold: number
  setThresholds: (redOrange: number, orangeGreen: number) => void
  resetThresholds: () => void
}

export const useSettingsStore = create<GradeSettingsState>()(
  persist(
    (set) => ({
      redOrangeThreshold: DEFAULT_THRESHOLDS.redOrange,
      orangeGreenThreshold: DEFAULT_THRESHOLDS.orangeGreen,
      setThresholds: (redOrangeThreshold, orangeGreenThreshold) =>
        set({ redOrangeThreshold, orangeGreenThreshold }),
      resetThresholds: () =>
        set({
          redOrangeThreshold: DEFAULT_THRESHOLDS.redOrange,
          orangeGreenThreshold: DEFAULT_THRESHOLDS.orangeGreen,
        }),
    }),
    { name: 'settings' },
  ),
)
