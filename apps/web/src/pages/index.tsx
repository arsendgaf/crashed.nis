import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  CheckCircleIcon,
  FunnelIcon,
  FunnelSimpleIcon,
  NotepadIcon,
  SortAscendingIcon,
  SortDescendingIcon,
} from '@phosphor-icons/react'
import { Navigate, useSearchParams } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Badge } from '@crashednis/ui/components/badge'
import { Button } from '@crashednis/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crashednis/ui/components/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@crashednis/ui/components/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@crashednis/ui/components/item'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { useMediaQuery } from '@crashednis/ui/hooks/use-media-query'
import { Slider } from '@crashednis/ui/components/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crashednis/ui/components/tabs'
import { cn } from '@crashednis/ui/lib/utils'
import { api } from '@/lib/api/client'
import { ApiRpcError, useApiSWR } from '@/lib/api/use-api-swr'
import { SubjectRubricModal } from '@/components/subject-rubric-modal'
import { gradeStatusFor, GRADE_BG } from '@/lib/grades'
import {
  MAX_PERCENT,
  MIN_PERCENT,
  useJournalStore,
  type JournalSortKey,
} from '@/lib/stores/journal-store'
import { useSettingsStore } from '@/lib/stores/settings-store'

// Journal response is a fixed array of the four school quarters (NIS returns
// them all at once), so quarters are switched client-side instead of fetching
// each one separately. The active quarter is mirrored into the search params,
// and defaults to the period flagged isActual by NIS.
const QUARTERS = ['1', '2', '3', '4'] as const
const QUARTER_NUMERALS = ['I', 'II', 'III', 'IV'] as const

type Quarter = (typeof QUARTERS)[number]

const SORT_OPTIONS = [
  { key: 'score-asc', label: 'По возрастанию', icon: SortAscendingIcon },
  { key: 'score-desc', label: 'По убыванию', icon: SortDescendingIcon },
  { key: 'alpha', label: 'По алфавиту', icon: FunnelSimpleIcon },
] as const satisfies ReadonlyArray<{
  key: JournalSortKey
  label: string
  icon: typeof SortAscendingIcon
}>

// Structural shape of one journal subject; mirrors the permissive upstream
// fields that the API passes through unchanged.
type RawSubject = {
  id: string
  name?: { ru?: string; kk?: string; en?: string }
  currScore?: number | null
  // NIS sends an empty string instead of a number when the subject is not graded yet.
  mark?: number | string | null
}

// Empty-string / non-numeric marks mean "not graded yet".
const normalizeMark = (mark: number | string | null | undefined): number | undefined => {
  if (mark === null || mark === undefined || mark === '') {
    return undefined
  }

  const value = typeof mark === 'number' ? mark : Number(mark)

  return Number.isFinite(value) && value > 0 ? value : undefined
}

type PreparedSubject = {
  id: string
  key: string
  title: string
  mark: number | undefined
  percent: number | null
}

const clampPercent = (value: number) =>
  Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, Math.round(value)))

const prepareSubjects = (subjects: readonly RawSubject[], quarter: Quarter): PreparedSubject[] =>
  subjects.map((subject, index) => ({
    id: subject.id,
    key: `${quarter}-${subject.id}-${index}`,
    title: subject.name?.ru ?? subject.name?.kk ?? subject.name?.en ?? subject.id,
    mark: normalizeMark(subject.mark),
    percent:
      subject.currScore === undefined || subject.currScore === null
        ? null
        : clampPercent(subject.currScore),
  }))

const applyView = (
  subjects: PreparedSubject[],
  sort: JournalSortKey,
  onlyMarked: boolean,
  range: [number, number],
): PreparedSubject[] => {
  // Score-based narrowing hides subjects that have no score yet.
  const rangeRestricted = range[0] > MIN_PERCENT || range[1] < MAX_PERCENT
  const visible = subjects.filter(
    (subject) =>
      (!onlyMarked || subject.mark !== undefined) &&
      (!rangeRestricted ||
        (subject.percent !== null && subject.percent >= range[0] && subject.percent <= range[1])),
  )

  return visible.sort((a, b) => {
    if (sort === 'alpha') {
      return a.title.localeCompare(b.title, 'ru')
    }

    if (a.percent === null && b.percent === null) {
      return 0
    }

    if (a.percent === null) {
      return 1
    }

    if (b.percent === null) {
      return -1
    }

    return sort === 'score-asc' ? a.percent - b.percent : b.percent - a.percent
  })
}

export default function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = useJournalStore((state) => state.sort)
  const onlyMarked = useJournalStore((state) => state.onlyMarked)
  const percentRange = useJournalStore((state) => state.percentRange)
  const setSort = useJournalStore((state) => state.setSort)
  const setOnlyMarked = useJournalStore((state) => state.setOnlyMarked)
  const setPercentRange = useJournalStore((state) => state.setPercentRange)
  const resetView = useJournalStore((state) => state.resetView)

  // NIS returns all four quarters in one payload, so the journal is fetched at
  // most once per 5 minutes; quarter tab switches and remounts reuse cache.
  const { data, error, mutate } = useApiSWR('journal', () => api.api.v1.journal.$get(), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000,
  })

  const ActiveSortIcon = (SORT_OPTIONS.find((option) => option.key === sort) ?? SORT_OPTIONS[2])
    .icon
  const hasActiveFilters =
    onlyMarked || percentRange[0] > MIN_PERCENT || percentRange[1] < MAX_PERCENT

  const rawQuarter = searchParams.get('quarter') ?? ''
  const actualQuarter = data?.findIndex((period) => period.isActual === true) ?? -1
  const defaultQuarter: Quarter = actualQuarter >= 0 ? QUARTERS[Math.min(3, actualQuarter)] : '1'
  const activeQuarter: Quarter = (QUARTERS as readonly string[]).includes(rawQuarter)
    ? (rawQuarter as Quarter)
    : defaultQuarter

  // The open rubric modal lives in the URL (?subject=<id>): opening pushes a
  // history entry so the browser Back button closes it, and closing replaces
  // the entry so it does not pollute the history.
  const rawSubject = searchParams.get('subject') ?? ''
  const preparedActive = prepareSubjects(
    data?.[Number(activeQuarter) - 1]?.subjects ?? [],
    activeQuarter,
  )
  const selectedSubject = preparedActive.find((subject) => subject.id === rawSubject) ?? null

  const closeSubject = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('subject')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const openSubject = (subjectId: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('quarter', activeQuarter)
      next.set('subject', subjectId)
      return next
    })
  }

  // The active quarter flipped or data was refreshed without the subject: keep
  // the URL clean instead of leaving a param that opens nothing.
  useEffect(() => {
    if (rawSubject !== '' && selectedSubject === null) {
      closeSubject()
    }
  }, [rawSubject, selectedSubject, closeSubject])

  if (error instanceof ApiRpcError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (error !== undefined) {
    return (
      <div className="flex min-h-[60dvh] w-full flex-col items-start gap-6">
        <Alert variant="destructive" className="w-full max-w-2xl">
          <AlertTitle>Не удалось загрузить журнал</AlertTitle>
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
      <div className="flex min-h-[60dvh] w-full flex-col gap-6" role="status" aria-live="polite">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-9 w-full max-w-md rounded-4xl" />
          <Skeleton className="h-9 w-full lg:w-80 rounded-4xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-[5.25rem] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs
        value={activeQuarter}
        onValueChange={(value) => {
          if (value === null) {
            return
          }

          setSearchParams(
            (previous) => {
              const next = new URLSearchParams(previous)
              next.set('quarter', String(value))
              return next
            },
            { replace: true },
          )
        }}
      >
        {/* Toolbar: stacked above the quarter tabs on mobile, sharing their row on desktop. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="order-2 flex gap-2 lg:flex-none">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Сортировка"
                    className="flex-1 lg:flex-none"
                  >
                    <ActiveSortIcon aria-hidden="true" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => {
                    const selected = SORT_OPTIONS.find((option) => option.key === value)

                    if (selected !== undefined) {
                      setSort(selected.key)
                    }
                  }}
                >
                  {SORT_OPTIONS.map((option) => {
                    const OptionIcon = option.icon

                    return (
                      <DropdownMenuRadioItem key={option.key} value={option.key}>
                        <OptionIcon aria-hidden="true" className="text-muted-foreground" />
                        {option.label}
                      </DropdownMenuRadioItem>
                    )
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Фильтры"
                    className="relative flex-1 lg:flex-none"
                  >
                    <FunnelIcon aria-hidden="true" />
                    {hasActiveFilters && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                      />
                    )}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-muted-foreground text-xs">
                    Фильтры
                  </DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={onlyMarked}
                    onCheckedChange={(checked) => setOnlyMarked(checked === true)}
                    closeOnClick={false}
                  >
                    <CheckCircleIcon aria-hidden="true" className="text-muted-foreground" />
                    С оценкой
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div
                  role="group"
                  aria-label="Диапазон текущего балла"
                  className="flex items-center gap-2.5 px-2.5 py-2"
                >
                  <Slider
                    min={MIN_PERCENT}
                    max={MAX_PERCENT}
                    step={1}
                    value={percentRange}
                    onValueChange={(value) => {
                      if (Array.isArray(value) && value.length === 2) {
                        setPercentRange([value[0], value[1]])
                      }
                    }}
                    className="min-w-24 flex-1"
                  />
                  <span className="w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {percentRange[0]}–{percentRange[1]}%
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsList aria-label="Учебные четверти" className="order-1 w-full max-w-md">
            {QUARTER_NUMERALS.map((numeral, index) => (
              <TabsTrigger key={numeral} value={QUARTERS[index]} className="tabular-nums">
                {numeral}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {QUARTERS.map((quarter) => {
          const prepared = prepareSubjects(data[Number(quarter) - 1]?.subjects ?? [], quarter)
          const visible = applyView(prepared, sort, onlyMarked, percentRange)
          const isOverfiltered = visible.length === 0 && prepared.length > 0

          return (
            <TabsContent key={quarter} value={quarter}>
              {prepared.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" aria-hidden="true">
                      <NotepadIcon />
                    </EmptyMedia>
                    <EmptyTitle>Оценок пока нет</EmptyTitle>
                    <EmptyDescription>
                      В этой четверти ещё нет данных. Журнал появится здесь после синхронизации с
                      НИС.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : isOverfiltered ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" aria-hidden="true">
                      <FunnelSimpleIcon />
                    </EmptyMedia>
                    <EmptyTitle>Ничего не найдено</EmptyTitle>
                    <EmptyDescription>
                      Под текущие фильтры не подходит ни один предмет этой четверти.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button type="button" variant="outline" onClick={resetView}>
                      Сбросить фильтры
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <SubjectGrid subjects={visible} onOpen={openSubject} />
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <SubjectRubricModal
        subject={
          selectedSubject === null
            ? null
            : {
                id: selectedSubject.id,
                title: selectedSubject.title,
                mark: selectedSubject.mark,
                percent: selectedSubject.percent,
              }
        }
        quarter={Number(activeQuarter)}
        onClose={closeSubject}
      />
    </div>
  )
}

// Roving-tabindex grid: the entire subject grid is a single Tab stop, and the
// arrow keys move focus between the cards (left/right step by one, up/down by
// whole rows) — like a native data grid. Enter/Space stay native button
// activation and open the rubric modal.
function SubjectGrid({
  subjects,
  onOpen,
}: {
  subjects: PreparedSubject[]
  onOpen: (subjectId: string) => void
}) {
  const columns = useMediaQuery('(min-width: 64rem)') ? 2 : 1
  const [focusIndex, setFocusIndex] = useState(0)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Filters can shrink the list while the remembered index sits past its end.
  const activeIndex = subjects.length === 0 ? 0 : Math.min(focusIndex, subjects.length - 1)

  const cardKeyDown = (index: number) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    let step: number
    switch (event.key) {
      case 'ArrowRight': {
        step = 1
        break
      }
      case 'ArrowLeft': {
        step = -1
        break
      }
      case 'ArrowDown': {
        step = columns
        break
      }
      case 'ArrowUp': {
        step = -columns
        break
      }
      default:
        return
    }

    event.preventDefault()

    const next = Math.min(subjects.length - 1, Math.max(0, index + step))
    if (next !== index) {
      // focus() also scrolls the card into view.
      cardRefs.current[next]?.focus()
    }
  }

  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {subjects.map((subject, index) => (
        <li key={subject.key}>
          <JournalItem
            subject={subject}
            tabIndex={index === activeIndex ? 0 : -1}
            onOpen={onOpen}
            cardRef={(element) => {
              cardRefs.current[index] = element
            }}
            onKeyDown={cardKeyDown(index)}
            onFocus={() => {
              if (focusIndex !== index) {
                setFocusIndex(index)
              }
            }}
          />
        </li>
      ))}
    </ul>
  )
}

function JournalItem({
  subject,
  tabIndex,
  onOpen,
  cardRef,
  onKeyDown,
  onFocus,
}: {
  subject: PreparedSubject
  tabIndex: 0 | -1
  onOpen: (subjectId: string) => void
  cardRef: (element: HTMLButtonElement | null) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onFocus: () => void
}) {
  const redOrangeThreshold = useSettingsStore((state) => state.redOrangeThreshold)
  const orangeGreenThreshold = useSettingsStore((state) => state.orangeGreenThreshold)
  const status = gradeStatusFor(subject.percent, subject.mark, {
    redOrange: redOrangeThreshold,
    orangeGreen: orangeGreenThreshold,
  })

  return (
    <Item
      variant="outline"
      className="relative h-full cursor-pointer overflow-hidden hover:bg-muted/50"
      render={
        <button
          type="button"
          ref={cardRef}
          tabIndex={tabIndex}
          aria-haspopup="dialog"
          onClick={() => onOpen(subject.id)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
      }
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="text-[0.9375rem] leading-snug">{subject.title}</ItemTitle>
        <ItemDescription className="text-xs tabular-nums">
          {subject.percent === null
            ? 'Текущий балл пока неизвестен'
            : `Текущий балл — ${subject.percent}%`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {subject.mark === undefined ? (
          <Badge variant="secondary">
            <span aria-hidden="true">—</span>
            <span className="sr-only">Итоговая оценка ещё не выставлена</span>
          </Badge>
        ) : (
          <Badge className={cn('tabular-nums text-white', status !== null && GRADE_BG[status])}>
            <span className="sr-only">Итоговая оценка:</span>
            {subject.mark}
          </Badge>
        )}
      </ItemActions>
      {subject.percent !== null && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 bottom-0 h-0.5 rounded-full',
            status !== null && GRADE_BG[status],
          )}
          style={{ width: `${subject.percent}%` }}
        />
      )}
    </Item>
  )
}
