// Transcript (Табель) view helpers shared by the reports page and its subject
// modal: permissive view types over the NIS report-card payload, the fixed
// field order, and mark text/number/color plumbing. Upstream sends optional,
// nullable localized marks; extra properties pass through unseen.
export type Localized = { readonly ru?: string; readonly kk?: string; readonly en?: string }

export type TranscriptRow = {
  readonly subject?: { readonly id?: string; readonly name?: Localized }
  readonly firstPeriod?: Localized | null
  readonly secondPeriod?: Localized | null
  readonly thirdPeriod?: Localized | null
  readonly fourthPeriod?: Localized | null
  readonly firstHalfYearMark?: Localized | null
  readonly secondHalfYearMark?: Localized | null
  readonly yearMark?: Localized | null
  readonly examMark?: Localized | null
  readonly resultMark?: Localized | null
}

export type TranscriptCard = {
  readonly schoolYear?: {
    readonly isCurrent?: boolean
    readonly id?: string
    readonly name?: Localized
  }
  readonly reportCard?: readonly TranscriptRow[]
}

export type Thresholds = { readonly redOrange: number; readonly orangeGreen: number }

type MarkGroup = 'quarters' | 'halfYears' | 'totals'

export type MarkField = {
  readonly key: keyof Omit<TranscriptRow, 'subject'>
  /** Short chunk label used by the main table and the card («I», «Год»). */
  readonly label: string
  /** Self-describing label where more context is needed (dialog columns, «Четверть I»). */
  readonly fullLabel: string
  readonly group: MarkGroup
}

const FIELD = (
  key: keyof Omit<TranscriptRow, 'subject'>,
  label: string,
  group: MarkGroup,
  fullLabel: string,
): MarkField => ({ key, label, fullLabel, group })

export const MARK_FIELDS: readonly MarkField[] = [
  FIELD('firstPeriod', 'I', 'quarters', 'I ч.'),
  FIELD('secondPeriod', 'II', 'quarters', 'II ч.'),
  FIELD('thirdPeriod', 'III', 'quarters', 'III ч.'),
  FIELD('fourthPeriod', 'IV', 'quarters', 'IV ч.'),
  FIELD('firstHalfYearMark', 'I', 'halfYears', 'Полугодие I'),
  FIELD('secondHalfYearMark', 'II', 'halfYears', 'Полугодие II'),
  FIELD('yearMark', 'Год', 'totals', 'Год'),
  FIELD('examMark', 'Экзамен', 'totals', 'Экзамен'),
  FIELD('resultMark', 'Итог', 'totals', 'Итог'),
]

// The page's fixed column set (the layout is identical for every year): all
// four quarters plus the year and the final mark. Экзамен lives in the modal.
export const TABLE_MARK_FIELDS: readonly MarkField[] = MARK_FIELDS.filter(
  (field) => field.group !== 'halfYears' && field.key !== 'examMark',
)

// The card's quarter chunk.
const MINI_QUARTER_FIELDS: readonly MarkField[] = MARK_FIELDS.filter(
  (field) => field.group === 'quarters',
)

// The card's year/final chunk (no Экзамен — the modal carries it).
const MINI_TOTAL_FIELDS: readonly MarkField[] = MARK_FIELDS.filter(
  (field) => field.key === 'yearMark' || field.key === 'resultMark',
)

// Stacked column chunks inside one merged mini table. They stay separate
// (the finals keep their own 2-column header row) but share a single table so
// the whole thing reads as one: the phone card merges the finals pair with the
// quarters below it.
export const CARD_MINI_CHUNKS: readonly (readonly MarkField[])[] = [
  MINI_TOTAL_FIELDS,
  MINI_QUARTER_FIELDS,
]

// The subject modal's merged table: quarters, then half-years, then totals —
// all nine marks, each chunk with its own header row.
export const MODAL_MINI_CHUNKS: readonly (readonly MarkField[])[] = [
  MARK_FIELDS.filter((field) => field.group === 'quarters'),
  MARK_FIELDS.filter((field) => field.group === 'halfYears'),
  MARK_FIELDS.filter((field) => field.group === 'totals'),
]

export const localizedText = (text: Localized | null | undefined, fallback: string): string =>
  text?.ru ?? text?.kk ?? text?.en ?? fallback

// Marks arrive as localized text: digits ("5", possibly "4,5") for graded
// subjects, words ("Зачтено") for pass/fail kinds, empty for unassessed.
export const markText = (mark: Localized | null | undefined): string =>
  localizedText(mark, '').trim()

export const parseNumericMark = (text: string): number | null => {
  const normalized = text.replace(',', '.')

  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null
}

export const transcriptYearLabel = (card: TranscriptCard | undefined): string =>
  localizedText(card?.schoolYear?.name, 'Учебный год')

export const transcriptSubjectName = (row: TranscriptRow | undefined, index: number): string =>
  localizedText(row?.subject?.name, `Предмет ${index + 1}`)
