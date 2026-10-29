import { Link, Navigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Badge } from '@crashednis/ui/components/badge'
import { Button } from '@crashednis/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@crashednis/ui/components/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@crashednis/ui/components/drawer'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { useMediaQuery } from '@crashednis/ui/hooks/use-media-query'
import { cn } from '@crashednis/ui/lib/utils'
import { api } from '@/lib/api/client'
import { ApiRpcError, useApiSWR } from '@/lib/api/use-api-swr'
import { GRADE_BG, gradeStatusFor } from '@/lib/grades'
import {
  formatPercent,
  formatSum,
  type RubricLike,
  rubricMarkPair,
  rubricTitle,
  rubricViewFor,
} from '@/lib/rubrics'
import { useSettingsStore } from '@/lib/stores/settings-store' // The subject whose rubrics are shown; mirrors the prepared journal subject.

// The subject whose rubrics are shown; mirrors the prepared journal subject.
export type RubricSubject = {
  id: string
  title: string
  mark: number | undefined
  /** Journal current score (0–100), or null when NIS sent nothing. */
  percent: number | null
}

type SubjectRubricModalProps = {
  subject: RubricSubject | null
  quarter: number
  onClose: () => void
}

const QUARTER_NUMERALS = ['', 'I', 'II', 'III', 'IV'] as const

export function SubjectRubricModal({ subject, quarter, onClose }: SubjectRubricModalProps) {
  const isDesktop = useMediaQuery('(min-width: 64rem)')
  const quarterNumber = Math.min(4, Math.max(1, Math.round(quarter)))
  const open = subject !== null
  // Counting the key on the quarter as well lets the browser cache rubrics
  // for several quarters side by side; opening a rubric is a deliberate
  // action, so the cache lives two quiet minutes.
  const key =
    subject === null ? null : `journal-rubric-quarter${quarterNumber}-subject${subject.id}`

  const { data, error, mutate } = useApiSWR(
    key,
    () => {
      if (subject === null) {
        // Unreachable while the key above is null (SWR skips the request).
        return Promise.reject(new Error('Requested a subject rubric without a subject.'))
      }

      return api.api.v1.journal[':subject'].$get({
        param: { subject: subject.id },
        query: { quarter: String(quarterNumber) },
      })
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2 * 60 * 1000,
    },
  )

  if (error instanceof ApiRpcError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onClose()
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-full overflow-y-auto sm:max-w-xl">
          <DialogHeader className="gap-y-1">
            {subject !== null && (
              <>
                <DialogTitle className="text-2xl font-extrabold leading-snug" render={<h1 />}>
                  {subject.title}
                </DialogTitle>
                <DialogDescription>Четверть {QUARTER_NUMERALS[quarterNumber]}</DialogDescription>
              </>
            )}
          </DialogHeader>
          <RubricBody
            subject={subject}
            quarter={quarterNumber}
            data={data}
            error={error}
            mutate={mutate}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer
      showSwipeHandle
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="mb-4">
          {subject !== null && (
            <>
              <DrawerTitle className="text-2xl font-extrabold leading-snug" render={<h1 />}>
                {subject.title}
              </DrawerTitle>
              <DrawerDescription>Четверть {QUARTER_NUMERALS[quarterNumber]}</DrawerDescription>
            </>
          )}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1">
          <RubricBody
            subject={subject}
            quarter={quarterNumber}
            data={data}
            error={error}
            mutate={mutate}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

type RubricBodyProps = {
  subject: RubricSubject | null
  quarter: number
  data:
    | {
        readonly sumChapterCriteria?: readonly RubricLike[]
        readonly sumQuarterCriteria?: readonly RubricLike[]
      }
    | undefined
  error: Error | undefined
  mutate: () => void
}

function RubricBody({ subject, quarter, data, error, mutate }: RubricBodyProps) {
  const redOrangeThreshold = useSettingsStore((state) => state.redOrangeThreshold)
  const orangeGreenThreshold = useSettingsStore((state) => state.orangeGreenThreshold)
  const thresholds = { redOrange: redOrangeThreshold, orangeGreen: orangeGreenThreshold }
  const view = rubricViewFor(data, subject?.percent ?? null)
  const status = gradeStatusFor(view.percent, subject?.mark, thresholds)

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none font-semibold tabular-nums">
            {view.percent === null ? '—' : `${formatPercent(view.percent)}%`}
          </span>
          {view.byHalfYear && <Badge variant="outline">За полугодие</Badge>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {view.percent !== null && status !== null && (
            <div
              aria-hidden="true"
              className={cn('h-full rounded-full', GRADE_BG[status])}
              style={{ width: `${view.percent}%` }}
            />
          )}
        </div>
      </div>

      <RubricSection label="СОР" totals={view.chapter} rubrics={data.sumChapterCriteria} />
      <RubricSection label="СОЧ" totals={view.quarter} rubrics={data.sumQuarterCriteria} />

      {subject !== null && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          render={
            <Link to={`/predict?quarter=${quarter}&subject=${encodeURIComponent(subject.id)}`} />
          }
        >
          Предикт
        </Button>
      )}
    </div>
  )
}

function RubricSection({
  label,
  totals,
  rubrics,
}: {
  label: string
  totals: { sum: number; max: number; count: number } | null
  rubrics: readonly RubricLike[] | undefined
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
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
      {totals !== null && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {(rubrics ?? []).map((rubric, index) => {
            const { mark, max } = rubricMarkPair(rubric)

            return (
              <li key={index} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[0.8125rem] leading-snug">
                    {rubricTitle(rubric.title, `Рубрика ${index + 1}`)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {mark === null ? '—' : formatSum(mark)} / {formatSum(max)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
