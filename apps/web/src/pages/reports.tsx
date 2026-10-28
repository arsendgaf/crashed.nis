import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { StudentIcon } from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Button } from '@crashednis/ui/components/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@crashednis/ui/components/empty'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { cn } from '@crashednis/ui/lib/utils'
import { MarksMiniTable } from '@/components/marks-mini-table'
import { SubjectReportModal } from '@/components/subject-report-modal'
import { api } from '@/lib/api/client'
import { ApiRpcError, useApiSWR } from '@/lib/api/use-api-swr'
import { GRADE_TEXT, gradeStatusFor } from '@/lib/grades'
import { useSettingsStore } from '@/lib/stores/settings-store'
import {
  CARD_MINI_CHUNKS,
  type Localized,
  markText,
  parseNumericMark,
  TABLE_MARK_FIELDS,
  type Thresholds,
  type TranscriptCard,
  type TranscriptRow,
  transcriptSubjectName,
  transcriptYearLabel,
} from '@/lib/transcript'

const SELECT_CLASS =
  'h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

// Nav keys tie a year to its NIS id, falling back to the array index.
const yearKey = (card: TranscriptCard, index: number): string =>
  card.schoolYear?.id ?? String(index)

// 12px grey regular headers with the single rule under the whole header;
// word-level cells span both header rows, numeral columns sit under groups.
const MARK_HEAD_CLASS =
  'min-w-11 px-2 py-2 text-center align-bottom text-xs text-muted-foreground border-b border-border'

export default function ReportsPage() {
  const redOrangeThreshold = useSettingsStore((state) => state.redOrangeThreshold)
  const orangeGreenThreshold = useSettingsStore((state) => state.orangeGreenThreshold)

  // Reports (transcripts) change no more often than the journal: same 5-minute
  // throttle, no focus-based revalidation.
  const { data, error, mutate } = useApiSWR('reports', () => api.api.v1.reports.$get(), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000,
  })

  if (error instanceof ApiRpcError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (error !== undefined) {
    return (
      <div className="flex min-h-[60dvh] w-full flex-col gap-6">
        <Alert variant="destructive" className="w-full max-w-2xl">
          <AlertTitle>Не удалось загрузить табель</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Проверьте подключение к интернету и попробуйте ещё раз.</span>
            <Button type="button" variant="outline" onClick={() => void mutate()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (data === undefined) {
    return (
      <div className="flex min-h-[60dvh] w-full flex-col gap-3" role="status" aria-live="polite">
        <Skeleton className="h-9 w-56 rounded-4xl" />
        <Skeleton className="h-11 rounded-2xl" />
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Skeleton key={index} className="h-11 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <ReportsBody
      data={data}
      thresholds={{ redOrange: redOrangeThreshold, orangeGreen: orangeGreenThreshold }}
    />
  )
}

export function ReportsBody({
  data,
  thresholds,
}: {
  data: readonly TranscriptCard[]
  thresholds: Thresholds
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const cards = data

  // The active year lives in the URL (?year=) exactly like the journal's
  // quarter: the current school year is the default.
  const rawYear = searchParams.get('year') ?? ''
  const currentIndex = cards.findIndex((card) => card.schoolYear?.isCurrent === true)
  const defaultCardIndex = currentIndex >= 0 ? currentIndex : 0
  const activeCardIndex = cards.findIndex((card, index) => yearKey(card, index) === rawYear)
  const activeIndex = activeCardIndex >= 0 ? activeCardIndex : defaultCardIndex
  const activeCard = cards[activeIndex] as TranscriptCard | undefined

  // The open subject lives in the URL (?subject=) like the rubric modal:
  // opening pushes a history entry so Back closes, closing replaces the entry.
  // The key is the row's position (card + row index), NOT the NIS subject id:
  // rows can share or omit subject.id, and a positional key always resolves to
  // exactly the row that was tapped.
  const rawSubject = searchParams.get('subject') ?? ''
  const flatRows = cards.flatMap((card, cardIndex) =>
    (card.reportCard ?? []).map((row, rowIndex) => ({
      card,
      row,
      rowKey: `${cardIndex}:${rowIndex}`,
    })),
  )
  const selected =
    rawSubject === '' ? null : (flatRows.find((entry) => entry.rowKey === rawSubject) ?? null)

  // A stale subject (e.g. left in the URL after a data refresh) opens nothing;
  // keep the URL clean instead of leaving a dead param.
  useEffect(() => {
    if (rawSubject !== '' && selected === null) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.delete('subject')
          return next
        },
        { replace: true },
      )
    }
  }, [rawSubject, selected, setSearchParams])

  const openSubject = (rowKey: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (activeCard !== undefined) {
        next.set('year', yearKey(activeCard, activeIndex))
      }
      next.set('subject', rowKey)
      return next
    })
  }

  const closeSubject = () => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('subject')
        return next
      },
      { replace: true },
    )
  }

  const updateYear = (nextYear: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('year', nextYear)
        return next
      },
      { replace: true },
    )
  }

  const yearLabel = transcriptYearLabel(activeCard)
  const rows: readonly TranscriptRow[] = activeCard?.reportCard ?? []

  return (
    <div className="flex w-full flex-col gap-6">
      {cards.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon" aria-hidden="true">
              <StudentIcon />
            </EmptyMedia>
            <EmptyTitle>Отчётов пока нет</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* A native select outlives any number of school years, unlike a tab row. */}
          {cards.length > 1 && activeCard !== undefined && (
            <select
              aria-label="Учебный год"
              className={`w-full max-w-72 ${SELECT_CLASS}`}
              value={yearKey(activeCard, activeIndex)}
              onChange={(event) => updateYear(event.target.value)}
            >
              {cards.map((card, index) => (
                <option key={yearKey(card, index)} value={yearKey(card, index)}>
                  {transcriptYearLabel(card)}
                </option>
              ))}
            </select>
          )}

          {activeCard !== undefined &&
            (rows.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon" aria-hidden="true">
                    <StudentIcon />
                  </EmptyMedia>
                  <EmptyTitle>Оценок пока нет</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {/* Phone: subject name over the marks table bled flush to the card edges. */}
                <ul className="flex list-none flex-col gap-2.5 p-0 sm:hidden">
                  {rows.map((row, index) => {
                    const rowKey = `${activeIndex}:${index}`

                    return (
                      <li
                        key={rowKey}
                        className="relative flex flex-col overflow-hidden rounded-xl border has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                      >
                        <button
                          type="button"
                          onClick={() => openSubject(rowKey)}
                          className="w-full px-4 pt-4 pb-3 text-left text-lg font-bold md:font-regular md:text-sm font-medium leading-snug outline-none after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:underline underline-offset-4"
                        >
                          {transcriptSubjectName(row, index)}
                        </button>
                        <MarksMiniTable
                          chunks={CARD_MINI_CHUNKS}
                          labelKind="short"
                          row={row}
                          thresholds={thresholds}
                          caption={`Оценки: ${transcriptSubjectName(row, index)}`}
                          emphasize="resultMark"
                        />
                      </li>
                    )
                  })}
                </ul>

                {/* From `sm` up: the real transcript table, identical for every year. */}
                <table className="hidden w-full border-collapse sm:table">
                  <caption className="sr-only">Табель оценок за {yearLabel}</caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        rowSpan={2}
                        className={cn(MARK_HEAD_CLASS, 'min-w-0 w-full pl-0 text-left')}
                      >
                        Предмет
                      </th>
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className={cn(MARK_HEAD_CLASS, 'border-b-0')}
                      >
                        Четверти
                      </th>
                      <th scope="col" rowSpan={2} className={MARK_HEAD_CLASS}>
                        Год
                      </th>
                      <th scope="col" rowSpan={2} className={MARK_HEAD_CLASS}>
                        Итог
                      </th>
                    </tr>
                    <tr>
                      {TABLE_MARK_FIELDS.filter((field) => field.group === 'quarters').map(
                        (field) => (
                          <th scope="col" key={field.key} className={MARK_HEAD_CLASS}>
                            {field.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const rowKey = `${activeIndex}:${index}`

                      return (
                        <tr key={rowKey} className="border-b border-border/60 last:border-b-0">
                          <td className="p-0 align-middle">
                            <button
                              type="button"
                              onClick={() => openSubject(rowKey)}
                              className="block w-full px-3 py-2.5 pl-0 text-left text-sm outline-none hover:underline focus-visible:underline underline-offset-4"
                            >
                              {transcriptSubjectName(row, index)}
                            </button>
                          </td>
                          {TABLE_MARK_FIELDS.map((field) => (
                            <MarkCell
                              key={field.key}
                              mark={row[field.key]}
                              thresholds={thresholds}
                              emphasize={field.key === 'resultMark'}
                            />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            ))}
        </>
      )}

      <SubjectReportModal
        row={selected?.row ?? null}
        yearLabel={transcriptYearLabel(selected?.card)}
        thresholds={thresholds}
        onClose={closeSubject}
      />
    </div>
  )
}

function MarkCell({
  mark,
  thresholds,
  emphasize,
}: {
  mark: Localized | null | undefined
  thresholds: Thresholds
  emphasize: boolean
}) {
  const text = markText(mark)
  const numeric = parseNumericMark(text)
  const status = numeric === null ? null : gradeStatusFor(null, numeric, thresholds)

  return (
    <td
      className={cn(
        'min-w-11 px-2 py-2.5 text-center text-sm align-middle tabular-nums',
        emphasize && 'font-medium',
        status !== null && GRADE_TEXT[status],
      )}
    >
      {text === '' ? <span className="text-muted-foreground">—</span> : text}
    </td>
  )
}
