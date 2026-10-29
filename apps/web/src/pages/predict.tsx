import { useEffect } from 'react'
import { MathOperationsIcon } from '@phosphor-icons/react'
import { Navigate, useSearchParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Button } from '@crashednis/ui/components/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@crashednis/ui/components/empty'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { PredictCalculator } from '@/components/predict-calculator'
import { api } from '@/lib/api/client'
import { ApiRpcError, useApiSWR } from '@/lib/api/use-api-swr'
import { rubricTitle } from '@/lib/rubrics'
import { usePredictStore } from '@/lib/stores/predict-store'
import { MAX_PERCENT, MIN_PERCENT } from '@/lib/stores/journal-store'

const QUARTERS = ['1', '2', '3', '4'] as const
const QUARTER_NUMERALS = ['I', 'II', 'III', 'IV'] as const

type Quarter = (typeof QUARTERS)[number]

// Only what the quarter/subject selectors need from the journal payload.
type RawSubject = {
  id: string
  name?: { ru?: string; kk?: string; en?: string }
  currScore?: number | null
}

const SELECT_CLASS =
  'h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

// Journal score for the prediction reference, same integer clamping as the
// journal page so the half-year shape reads identically.
const journalPercentFor = (subject: RawSubject | undefined): number | null => {
  const score = subject?.currScore

  if (score === undefined || score === null) {
    return null
  }

  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(score)))
}

export default function PredictPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lastPrediction = usePredictStore((state) => state.last)

  const journal = useApiSWR('journal', () => api.api.v1.journal.$get(), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000,
  })

  const { data: journalData, error: journalError, mutate: revalidateJournal } = journal

  // The URL wins; without an explicit quarter the last predicted configuration
  // is the remembered default, with the NIS actual quarter as fallback.
  const rawQuarter = searchParams.get('quarter') ?? ''
  const rawSubject = searchParams.get('subject') ?? ''
  const rememberedQuarter =
    lastPrediction !== null && (QUARTERS as readonly string[]).includes(lastPrediction.quarter)
      ? (lastPrediction.quarter as Quarter)
      : null

  const hasQuarterParam = rawQuarter !== ''
  const actualQuarter = journalData?.findIndex((period) => period.isActual === true) ?? -1
  const defaultQuarter: Quarter = rememberedQuarter
    ? rememberedQuarter
    : actualQuarter >= 0
      ? QUARTERS[Math.min(3, actualQuarter)]
      : '1'
  const activeQuarter: Quarter = hasQuarterParam ? (rawQuarter as Quarter) : defaultQuarter

  const subjects: readonly RawSubject[] = journalData?.[Number(activeQuarter) - 1]?.subjects ?? []
  const selectedSubject =
    journalData === undefined
      ? null
      : (subjects.find((subject) => subject.id === rawSubject) ?? null)

  // A stale subject (e.g. left in the URL after a data refresh) opens nothing;
  // keep the URL clean instead of leaving a dead param.
  useEffect(() => {
    if (journalData !== undefined && rawSubject !== '' && selectedSubject === null) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.delete('subject')
          return next
        },
        { replace: true },
      )
    }
  }, [journalData, rawSubject, selectedSubject, setSearchParams])

  // Plain /predict visit: restore the remembered prediction (quarter + subject)
  // so the sandbox the student left keeps its configuration. Any explicit
  // choice in the URL — a deep link or a manual selection — is never replaced.
  const canRestoreFromMemory =
    lastPrediction !== null &&
    lastPrediction.subjectId !== '' &&
    rememberedQuarter !== null &&
    rawQuarter === '' &&
    rawSubject === ''

  useEffect(() => {
    if (journalData === undefined || !canRestoreFromMemory) {
      return
    }

    const referenced = journalData[Number(rememberedQuarter) - 1]?.subjects ?? []
    if (referenced.some((subject) => subject.id === lastPrediction?.subjectId)) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set('quarter', rememberedQuarter)
          next.set('subject', lastPrediction?.subjectId ?? '')
          return next
        },
        { replace: true },
      )
    }
  }, [
    journalData,
    canRestoreFromMemory,
    rememberedQuarter,
    lastPrediction?.subjectId,
    setSearchParams,
  ])

  const updateParams = (quarter: string | undefined, subject: string | undefined) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (quarter !== undefined) {
          next.set('quarter', quarter)
        }
        if (subject !== undefined) {
          if (subject === '') {
            next.delete('subject')
          } else {
            next.set('subject', subject)
          }
        }
        return next
      },
      { replace: true },
    )
  }

  // The rubric key/fetcher/throttling below are identical to the rubric
  // modal's, so navigating here from a rubric reuses the cached entry and
  // the two features never fetch the same subject twice.
  const rubricKey =
    selectedSubject === null
      ? null
      : `journal-rubric-quarter${activeQuarter}-subject${selectedSubject.id}`
  const rubric = useApiSWR(
    rubricKey,
    () => {
      if (selectedSubject === null) {
        // Unreachable while the key above is null (SWR skips the request).
        return Promise.reject(new Error('Requested subject rubrics without a subject.'))
      }

      return api.api.v1.journal[':subject'].$get({
        param: { subject: selectedSubject.id },
        query: { quarter: String(activeQuarter) },
      })
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2 * 60 * 1000,
    },
  )

  return (
    <div className="flex w-full flex-col gap-6">
      {journalError instanceof ApiRpcError && journalError.status === 401 ? (
        <Navigate to="/auth" replace />
      ) : journalError !== undefined ? (
        <div className="flex min-h-[60dvh] w-full flex-col items-start gap-6">
          <Alert variant="destructive" className="w-full max-w-2xl">
            <AlertTitle>Не удалось загрузить журнал</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <Button type="button" variant="outline" onClick={() => void revalidateJournal()}>
                Повторить
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            {journalData === undefined ? (
              <>
                <Skeleton className="h-9 w-full max-w-24 rounded-4xl" />
                <Skeleton className="h-9 min-w-0 flex-1 rounded-4xl" />
              </>
            ) : (
              <>
                <select
                  aria-label="Четверть"
                  value={activeQuarter}
                  onChange={(event) => updateParams(event.target.value, undefined)}
                  className={`w-full sm:w-28 ${SELECT_CLASS}`}
                >
                  {QUARTERS.map((quarter, index) => (
                    <option key={quarter} value={quarter}>
                      {QUARTER_NUMERALS[index]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Предмет"
                  value={selectedSubject?.id ?? ''}
                  onChange={(event) => updateParams(undefined, event.target.value)}
                  className={`w-full sm:flex-1 ${SELECT_CLASS}`}
                >
                  <option value="">Выберите предмет</option>
                  {subjects.map((subject, index) => (
                    <option key={`${subject.id}-${index}`} value={subject.id}>
                      {rubricTitle(subject.name, subject.id)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {journalData !== undefined &&
            (selectedSubject === null ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon" aria-hidden="true">
                    <MathOperationsIcon />
                  </EmptyMedia>
                  <EmptyTitle>Выберите предмет</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <PredictCalculator
                key={`${activeQuarter}-${selectedSubject.id}`}
                quarter={activeQuarter}
                subjectId={selectedSubject.id}
                journalPercent={journalPercentFor(selectedSubject)}
                data={rubric.data}
                error={rubric.error}
                mutate={rubric.mutate}
              />
            ))}
        </>
      )}
    </div>
  )
}
