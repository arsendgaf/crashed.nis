import { Navigate, Outlet, useLocation } from 'react-router'
import { GearSixIcon, MathOperationsIcon, NotepadIcon, StudentIcon } from '@phosphor-icons/react'
import { useHotkeys } from '@tanstack/react-hotkeys'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Button } from '@crashednis/ui/components/button'
import { Kbd, KbdGroup } from '@crashednis/ui/components/kbd'
import { Logo } from '@crashednis/ui/components/logo'
import { Skeleton } from '@crashednis/ui/components/skeleton'
import { Spinner } from '@crashednis/ui/components/spinner'
import { cn } from '@crashednis/ui/lib/utils'
import { api } from '@/lib/api/client'
import { ApiRpcError, useApiSWR } from '@/lib/api/use-api-swr'
import { Link, useNavigate } from '../src/router'

const navigation = [
  {
    to: '/',
    label: 'Журнал',
    description: 'Журнал оценок и предметов',
    icon: NotepadIcon,
    hotkey: ['G', 'J'],
  },
  {
    to: '/reports',
    label: 'Табель',
    description: 'Четвертные и итоговые отчёты',
    icon: StudentIcon,
    hotkey: ['G', 'R'],
  },
  {
    to: '/predict',
    label: 'Прогноз',
    description: 'Песочница прогноза оценок',
    icon: MathOperationsIcon,
    hotkey: ['G', 'P'],
  },
  {
    to: '/settings',
    label: 'Настройки',
    description: 'Оформление и выход из системы',
    icon: GearSixIcon,
    hotkey: ['G', 'S'],
  },
] as const

// Shared styling for sidebar entries so links and the menu trigger behave identically.
// Mobile keeps the labelled bottom bar; on desktop the rail follows the shadcn Sidebar
// measurements: p-2 rail sleeve, h-8 rounded-md p-2 text-sm menu buttons, size-4 icons.
const sidebarItemClass = cn(
  'flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 text-center no-underline transition-colors duration-150 motion-reduce:transition-none',
  'sm:min-h-12 sm:px-3',
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'lg:h-8 lg:min-h-0 lg:w-full lg:flex-row lg:items-center lg:justify-start lg:gap-2 lg:overflow-hidden lg:rounded-md lg:p-2 lg:text-left lg:text-sm',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
)

const sidebarItemIconClass = cn('size-5 shrink-0 lg:size-4')

const sidebarItemLabelClass = cn(
  'sr-only font-medium leading-tight sm:not-sr-only sm:inline sm:text-xs lg:truncate lg:text-sm lg:font-normal',
)

const activeItemClass = cn('bg-sidebar-accent text-sidebar-accent-foreground', 'lg:font-medium')

export function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    data,
    error,
    isLoading,
    mutate: revalidateSession,
  } = useApiSWR('auth-session', () => api.api.v1.auth.session.$get())
  // Contingent info (name, class, school) rarely changes: cache it for a long
  // time and never revalidate on focus/interval so we go easy on the NIS API.
  const { data: contingentData, isLoading: isContingentLoading } = useApiSWR(
    'contingent',
    () => api.api.v1.contingent.$get(),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10 * 60 * 1000,
    },
  )

  const contingentProfile = contingentData?.data
  const firstName = contingentData?.firstName ?? ''
  const lastName = contingentData?.lastName ?? ''
  const profileName =
    firstName === '' && lastName === '' ? 'crashed.nis' : `${lastName} ${firstName}`.trim()
  const klassName = contingentProfile?.Klass ?? null
  const schoolName = contingentProfile?.School?.Name
  const schoolTitle = schoolName?.ru ?? schoolName?.kk ?? schoolName?.en ?? null
  const profileCaption = [klassName, schoolTitle].filter(Boolean).join(' — ')

  useHotkeys(
    navigation.map((item) => ({
      hotkey: [...item.hotkey],
      callback: () => void navigate(item.to),
      options: {
        meta: { name: item.label, description: item.description, group: 'Навигация' },
      },
    })),
  )

  if (error instanceof ApiRpcError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (data === undefined && error !== undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Не удалось проверить авторизацию</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>Проверьте подключение к интернету и попробуйте ещё раз.</span>
          <Button type="button" variant="outline" onClick={() => void revalidateSession()}>
            Повторить
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (data === undefined) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center gap-3 bg-background"
        role="status"
        aria-live="polite"
      >
        <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
        <span className="text-sm text-muted-foreground">
          {isLoading ? 'Проверяем авторизацию…' : 'Загружаем…'}
        </span>
      </div>
    )
  }

  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-sidebar lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1">
      <a
        href="#dashboard-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-background focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Перейти к содержимому
      </a>

      <aside className="row-start-2 flex min-w-0 flex-row items-center gap-1 bg-sidebar px-3 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:row-start-auto lg:flex-col lg:items-stretch lg:gap-0 lg:px-2 lg:py-2">
        {/* Identity header, matching the shadcn Sidebar user block: h-12 rounded-md p-2. */}
        <div className="hidden lg:flex lg:h-12 lg:w-full lg:items-center lg:gap-2 lg:rounded-md lg:p-2 lg:text-left">
          <Logo aria-hidden="true" className="size-8 shrink-0 rounded-lg text-foreground" />
          <div className="flex min-w-0 flex-col">
            {isContingentLoading ? (
              <>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="mt-1.5 h-4 w-40" />
              </>
            ) : (
              <>
                <span className="truncate text-[0.9375rem] font-semibold leading-tight">
                  {profileName}
                </span>
                {profileCaption !== '' && (
                  <span className="truncate text-xs text-muted-foreground">{profileCaption}</span>
                )}
              </>
            )}
          </div>
        </div>

        <nav aria-label="Основная навигация" className="mt-0 flex-1 lg:mt-2">
          <ul className="m-0 flex list-none flex-row gap-1 p-0 lg:flex-col lg:gap-0">
            {navigation.map((item) => {
              const isCurrent = location.pathname === item.to
              const Icon = item.icon

              return (
                <li className="min-w-0 flex-1 lg:flex-none " key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      sidebarItemClass,
                      isCurrent ? activeItemClass : 'text-sidebar-foreground',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      weight={isCurrent ? 'fill' : 'regular'}
                      className={sidebarItemIconClass}
                    />
                    <span className={sidebarItemLabelClass}>{item.label}</span>
                    <KbdGroup aria-hidden="true" className="hidden lg:ml-auto lg:inline-flex">
                      <Kbd>{item.hotkey[0]}</Kbd>
                      <Kbd>{item.hotkey[1]}</Kbd>
                    </KbdGroup>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <main
        id="dashboard-content"
        tabIndex={-1}
        className="row-start-1 min-h-0 border-2 min-w-0 overflow-y-auto overscroll-contain rounded-t-none rounded-b-xl bg-background shadow-[0_0.75rem_1.5rem_-1.25rem_rgb(15_23_42_/_0.45)] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 lg:row-start-auto lg:rounded-t-xl lg:shadow-[-0.75rem_0_1.75rem_-1.5rem_rgb(15_23_42_/_0.45)]"
      >
        <div className="mx-auto w-full max-w-6xl p-3 lg:p-[clamp(2rem,5vw,4.5rem)]">
          <header className="-mx-3 sticky top-0 z-10 flex min-w-0 items-center gap-2.5 bg-linear-to-b from-background via-background/60 to-transparent px-3 pb-4 pt-3 lg:hidden">
            <Logo aria-hidden="true" className="size-7 shrink-0 text-foreground" />
            {isContingentLoading ? (
              <div className="flex min-w-0 flex-col">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-1 h-3.5 w-40" />
              </div>
            ) : (
              <div className="flex min-w-0 flex-col">
                <span className="break-words text-[0.9375rem] font-semibold leading-[1.15]">
                  {profileName}
                </span>
                {profileCaption !== '' && (
                  <span className="text-xs leading-[1.15] text-muted-foreground">
                    {profileCaption}
                  </span>
                )}
              </div>
            )}
          </header>

          <Outlet />
        </div>
      </main>
    </div>
  )
}
