// Permissive shapes mirroring the permissive upstream rubric types the API
// passes through unchanged (apps/api/src/shared/schemas/auth.schemas.ts).
import { MAX_PERCENT, MIN_PERCENT } from '@/lib/stores/journal-store'

export type RubricTitle = { ru?: string; kk?: string; en?: string }

export type RubricLike = {
  title?: RubricTitle
  mark?: string | number | null
  maxMark?: string | number | null
}

export type RubricSum = { sum: number; max: number; count: number }

// Keeps the fractional part (rounded to two decimals) so the modal can display
// marks like 66.67% while still bounding the value to 0–100.
const clampPercent = (value: number) =>
  Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value * 100) / 100))

const rubricTitle = (title: RubricTitle | undefined, fallback: string): string =>
  title?.ru ?? title?.kk ?? title?.en ?? fallback

export { rubricTitle }

const rubricMark = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || typeof value !== 'number') {
    if (typeof value !== 'string' || value.trim() === '') {
      return null
    }

    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return value
}

const sums = (rubrics: readonly RubricLike[] | undefined): RubricSum | null => {
  if (rubrics === undefined || rubrics.length === 0) {
    return null
  }

  let sum = 0
  let max = 0
  let count = 0

  for (const rubric of rubrics) {
    const rubricMax = rubricMark(rubric.maxMark)

    if (rubricMax === null || rubricMax <= 0) {
      continue
    }

    sum += rubricMark(rubric.mark) ?? 0
    max += rubricMax
    count += 1
  }

  if (max <= 0) {
    return null
  }

  return { sum, max, count }
}

const sectionPercent = (section: RubricSum | null): number | null =>
  section === null ? null : (section.sum / section.max) * 100

export type RubricView = {
  /** Weighted percentage derived from the rubrics ourselves, 0–100. */
  percent: number | null
  /** True when the NIS journal score is exactly twice the computed one. */
  byHalfYear: boolean
  /** Chapter rubric (SOR) totals, or null when the section is empty. */
  chapter: RubricSum | null
  /** Quarter rubric (SOCH) totals, or null when the section is empty. */
  quarter: RubricSum | null
}

export const rubricViewFor = (
  rubric:
    | {
        readonly sumChapterCriteria?: readonly RubricLike[]
        readonly sumQuarterCriteria?: readonly RubricLike[]
      }
    | undefined,
  journalPercent: number | null,
): RubricView => {
  const chapter = sums(rubric?.sumChapterCriteria)
  const quarter = sums(rubric?.sumQuarterCriteria)
  const chapterPct = sectionPercent(chapter)
  const quarterPct = sectionPercent(quarter)

  // Chapters are worth 50% and the quarter another 50%; a missing section
  // contributes nothing, which is exactly the half-year shape NIS reports.
  const calc = 0.5 * (chapterPct ?? 0) + 0.5 * (quarterPct ?? 0)

  // When the journal reports a score that is our calculation doubled (±1),
  // the subject has no chapter rubric and is assessed once per half-year
  // instead of per quarter — the doubled value is the real percentage.
  const byHalfYear =
    journalPercent !== null && calc > 0 && Math.abs(Math.round(calc * 2) - journalPercent) <= 1

  return {
    percent: calc <= 0 ? null : clampPercent(byHalfYear ? calc * 2 : calc),
    byHalfYear,
    chapter,
    quarter,
  }
}

export const rubricMarkPair = (
  rubric: RubricLike,
): { mark: number | null; max: number; percent: number | null } => {
  const mark = rubricMark(rubric.mark)
  const max = rubricMark(rubric.maxMark)
  const percent = max !== null && max > 0 && mark !== null ? (mark / max) * 100 : null

  return { mark, max: max ?? 0, percent }
}

// --- Mark sandbox (/predict) ---

// Whole values print as integers, fractions keep one decimal: 12.5 → «12.5», 20 → «20».
export const formatSum = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)

// Two digits after the dot unless they are zero: 66.67 → «66.67», 85.5 → «85.5», 85 → «85».
export const formatPercent = (value: number): string => value.toFixed(2).replace(/\.?0+$/, '')

// Parses a sandbox input value; an empty or non-numeric field parses to null.
export const parseNumberField = (value: string): number | null => {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : null
}

// Totals over the sandbox rubric entries. Entries without a positive max are
// skipped entirely, mirroring sums() over the upstream rubrics.
export const entriesTotals = (
  entries: readonly { mark: string; max: string }[],
): RubricSum | null => {
  let sum = 0
  let max = 0
  let count = 0

  for (const entry of entries) {
    const entryMax = parseNumberField(entry.max)

    if (entryMax === null || entryMax <= 0) {
      continue
    }

    sum += parseNumberField(entry.mark) ?? 0
    max += entryMax
    count += 1
  }

  if (max <= 0) {
    return null
  }

  return { sum, max, count }
}

// The sandbox twin of rubricViewFor: the same 50/50 weighting and half-year
// doubling, but over editable entries with the half-year flag fixed from the
// original rubric data instead of re-derived from the journal score.
export const predictPercent = (
  chapter: RubricSum | null,
  quarter: RubricSum | null,
  byHalfYear: boolean,
): number | null => {
  const chapterPct = sectionPercent(chapter)
  const quarterPct = sectionPercent(quarter)

  // Chapters are worth 50% and the quarter another 50%; a missing section
  // contributes nothing, which is exactly the half-year shape NIS reports.
  const calc = 0.5 * (chapterPct ?? 0) + 0.5 * (quarterPct ?? 0)

  return calc <= 0 ? null : clampPercent(byHalfYear ? calc * 2 : calc)
}
