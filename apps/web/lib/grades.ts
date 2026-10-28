// Color coding shared by the journal percent bars, mark badges, and the
// settings threshold slider segments.
export type GradeStatus = 'red' | 'orange' | 'green'

export const GRADE_BG: Record<GradeStatus, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  green: 'bg-emerald-500',
}

// Text variant for marks printed directly in tables (the transcript reads the
// mark itself as data, not as a filled badge).
export const GRADE_TEXT: Record<GradeStatus, string> = {
  red: 'text-red-500',
  orange: 'text-orange-500',
  green: 'text-emerald-500',
}

const percentStatus = (percent: number, redOrange: number, orangeGreen: number): GradeStatus =>
  percent >= orangeGreen ? 'green' : percent >= redOrange ? 'orange' : 'red'

const markStatus = (mark: number): GradeStatus =>
  mark >= 5 ? 'green' : mark >= 4 ? 'orange' : 'red'

/**
 * Color for a subject, driven entirely by the configured percentage bands:
 * the current score lands in a band and that band's color wins — exactly
 * what the settings slider shows. Subjects without a current score yet fall
 * back to the mark itself (5 → green, 4 → orange, ≤3 → red). States with
 * neither a mark nor a percentage get null.
 */
export const gradeStatusFor = (
  percent: number | null,
  mark: number | undefined,
  thresholds: { redOrange: number; orangeGreen: number },
): GradeStatus | null => {
  if (percent !== null) {
    return percentStatus(percent, thresholds.redOrange, thresholds.orangeGreen)
  }

  return mark === undefined ? null : markStatus(mark)
}
