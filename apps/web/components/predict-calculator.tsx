import { useMemo, useRef, useState } from 'react'
import { ArrowClockwiseIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { Navigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Badge } from '@crashednis/ui/components/badge'
import { Button } from '@crashednis/ui/components/button'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { cn } from '@crashednis/ui/lib/utils'
import { ApiRpcError } from '@/lib/api/use-api-swr'
import { GRADE_BG, gradeStatusFor, type GradeStatus } from '@/lib/grades'
import {
  entriesTotals,
  formatPercent,
  formatSum,
  predictPercent,
  rubricTitle,
  rubricViewFor,
  type RubricLike,
} from '@/lib/rubrics'
import { useSettingsStore } from '@/lib/stores/settings-store'

// One rubric row of the sandbox: the mark and max are always editable; custom
// rows added by the student also carry an editable name and a remove button.
type Entry = {
  key: string
  title: string
  mark: string
  max: string
  custom: boolean
}

const entriesFromRubrics = (rubrics: readonly RubricLike[] | undefined): Entry[] =>
  (rubrics ?? []).map((rubric, index) => ({
    key: `rubric-${index}`,
    title: rubricTitle(rubric.title, `Рубрика ${index + 1}`),
    mark: rubric.mark?.toString() ?? '',
    max: rubric.maxMark?.toString() ?? '',
    custom: false,
  }))

// Band → quarter mark reading: the configured percentage bands are authoritative.
const predictedMark = (status: GradeStatus): number =>
  status === 'green' ? 5 : status === 'orange' ? 4 : 3

const MARK_INPUT_CLASS = cn(
  'h-7 w-14 rounded-lg border border-input bg-input/30 px-2 py-0.5 text-right text-sm tabular-nums transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
)

const NAME_INPUT_CLASS = cn(
  'h-7 min-w-0 flex-1 rounded-lg border border-input bg-input/30 px-2.5 text-[0.8125rem] transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
)

export type RubricData = {
  readonly sumChapterCriteria?: readonly RubricLike[]
  readonly sumQuarterCriteria?: readonly RubricLike[]
}

// Mark sandbox for one subject: prefilled from the fetched rubrics; every edit
// recalculates the quarter mark live. The fetch/error/loading circuitry mirrors
// the rubric modal, and mounts the body only once data is present so entries
// initialize from real rubrics and survive revalidations.
export function PredictCalculator({
  journalPercent,
  data,
  error,
  mutate,
}: {
  journalPercent: number | null
  data: RubricData | undefined
  error: Error | undefined
  mutate: () => void
}) {
  if (error instanceof ApiRpcError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (error !== undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Не удалось загрузить рубрики</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <Button type="button" variant="outline" onClick={mutate}>
            Повторить
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <Skeleton className="h-6 w-40 rounded-4xl" />
        <Skeleton className="h-11 rounded-2xl" />
        <Skeleton className="mt-2 h-6 w-40 rounded-4xl" />
        <Skeleton className="h-11 rounded-2xl" />
      </div>
    )
  }

  return <PredictBody journalPercent={journalPercent} data={data} />
}

function PredictBody({
  journalPercent,
  data,
}: {
  journalPercent: number | null
  data: RubricData
}) {
  const redOrangeThreshold = useSettingsStore((state) => state.redOrangeThreshold)
  const orangeGreenThreshold = useSettingsStore((state) => state.orangeGreenThreshold)
  const customCounter = useRef(0)

  const [chapterEntries, setChapterEntries] = useState<Entry[]>(() =>
    entriesFromRubrics(data.sumChapterCriteria),
  )
  const [quarterEntries, setQuarterEntries] = useState<Entry[]>(() =>
    entriesFromRubrics(data.sumQuarterCriteria),
  )

  // The half-year shape is a property of the real rubric data — changing
  // sandbox marks must not flip it.
  const byHalfYear = useMemo(
    () => rubricViewFor(data, journalPercent).byHalfYear,
    [data, journalPercent],
  )

  const sectionSetter = (section: Section) =>
    section === 'chapter' ? setChapterEntries : setQuarterEntries

  const chapterTotals = entriesTotals(chapterEntries)
  const quarterTotals = entriesTotals(quarterEntries)
  const percent = predictPercent(chapterTotals, quarterTotals, byHalfYear)
  const status = gradeStatusFor(percent, undefined, {
    redOrange: redOrangeThreshold,
    orangeGreen: orangeGreenThreshold,
  })

  const patchEntry = (section: Section, key: string, patch: Partial<Entry>) => {
    sectionSetter(section)((entries) =>
      entries.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    )
  }

  const addEntry = (section: Section) => {
    const key = `custom-${customCounter.current++}`
    sectionSetter(section)((entries) => [
      ...entries,
      { key, title: '', mark: '0', max: '10', custom: true },
    ])
  }

  const removeEntry = (section: Section, key: string) => {
    sectionSetter(section)((entries) => entries.filter((entry) => entry.key !== key))
  }

  const resetEntries = (section: Section) => {
    sectionSetter(section)(
      entriesFromRubrics(section === 'chapter' ? data.sumChapterCriteria : data.sumQuarterCriteria),
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none font-semibold tabular-nums">
            {percent === null ? '—' : `${formatPercent(percent)}%`}
          </span>
          {byHalfYear && <Badge variant="outline">За полугодие</Badge>}
          {status !== null && (
            <Badge className={cn('tabular-nums text-white', GRADE_BG[status])}>
              <span className="sr-only">Прогноз оценки:</span>
              {predictedMark(status)}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              resetEntries('chapter')
              resetEntries('quarter')
            }}
          >
            <ArrowClockwiseIcon aria-hidden="true" />
            Сбросить
          </Button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {percent !== null && status !== null && (
            <div
              aria-hidden="true"
              className={cn('h-full rounded-full', GRADE_BG[status])}
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
      </div>

      <section aria-label="СОР" className="flex flex-col gap-2.5">
        <SectionHeader label="СОР" totals={chapterTotals} />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {chapterEntries.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              onPatch={(patch) => patchEntry('chapter', entry.key, patch)}
              onRemove={entry.custom ? () => removeEntry('chapter', entry.key) : undefined}
            />
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => addEntry('chapter')}
        >
          <PlusIcon aria-hidden="true" />
          Добавить
        </Button>
      </section>

      <section aria-label="СОЧ" className="flex flex-col gap-2.5">
        <SectionHeader label="СОЧ" totals={quarterTotals} />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {quarterEntries.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              onPatch={(patch) => patchEntry('quarter', entry.key, patch)}
              onRemove={entry.custom ? () => removeEntry('quarter', entry.key) : undefined}
            />
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => addEntry('quarter')}
        >
          <PlusIcon aria-hidden="true" />
          Добавить
        </Button>
      </section>
    </div>
  )
}

type Section = 'chapter' | 'quarter'

function SectionHeader({
  label,
  totals,
}: {
  label: string
  totals: ReturnType<typeof entriesTotals>
}) {
  return (
    <header className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {totals === null
          ? 'Нет данных'
          : `${formatSum(totals.sum)}/${formatSum(totals.max)} — ${formatPercent(
              (totals.sum / totals.max) * 50,
            )}%`}
      </span>
    </header>
  )
}

function EntryRow({
  entry,
  onPatch,
  onRemove,
}: {
  entry: Entry
  onPatch: (patch: Partial<Entry>) => void
  onRemove: (() => void) | undefined
}) {
  if (onRemove === undefined) {
    return (
      <li className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">{entry.title}</span>
        <span className="flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums text-muted-foreground">
          <input
            type="number"
            step="any"
            aria-label={`${entry.title}: балл`}
            value={entry.mark}
            onChange={(event) => onPatch({ mark: event.target.value })}
            className={MARK_INPUT_CLASS}
          />
          /
          <input
            type="number"
            step="any"
            aria-label={`${entry.title}: максимум`}
            value={entry.max}
            onChange={(event) => onPatch({ max: event.target.value })}
            className={MARK_INPUT_CLASS}
          />
        </span>
      </li>
    )
  }

  return (
    <li className="flex items-baseline gap-1.5">
      <input
        type="text"
        aria-label="Название рубрики"
        placeholder="Название"
        value={entry.title}
        onChange={(event) => onPatch({ title: event.target.value })}
        className={NAME_INPUT_CLASS}
      />
      <span className="flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums text-muted-foreground">
        <input
          type="number"
          step="any"
          aria-label="Балл"
          value={entry.mark}
          onChange={(event) => onPatch({ mark: event.target.value })}
          className={MARK_INPUT_CLASS}
        />
        /
        <input
          type="number"
          step="any"
          aria-label="Максимум"
          value={entry.max}
          onChange={(event) => onPatch({ max: event.target.value })}
          className={MARK_INPUT_CLASS}
        />
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Удалить рубрику"
        onClick={onRemove}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </li>
  )
}
