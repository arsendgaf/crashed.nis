import { useState } from 'react'
import { DevicesIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react'
import { useSWRConfig } from 'swr'
import { Alert, AlertDescription, AlertTitle } from '@crashednis/ui/components/alert'
import { Button } from '@crashednis/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@crashednis/ui/components/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@crashednis/ui/components/drawer'
import { useMediaQuery } from '@crashednis/ui/hooks/use-media-query'
import { Slider } from '@crashednis/ui/components/slider'
import { ToggleGroup, ToggleGroupItem } from '@crashednis/ui/components/toggle-group'
import { cn } from '@crashednis/ui/lib/utils'
import { api } from '@/lib/api/client'
import { GRADE_BG } from '@/lib/grades'
import { useSettingsStore } from '@/lib/stores/settings-store'
import type { Theme } from '@/lib/providers/theme-provider'
import { useTheme } from '@/lib/providers/theme-provider'
import { useNavigate } from '../router'

const THEME_OPTIONS = [
  { value: 'light', label: 'Светлая', icon: SunIcon },
  { value: 'dark', label: 'Тёмная', icon: MoonIcon },
  { value: 'system', label: 'Системная', icon: DevicesIcon },
] as const satisfies ReadonlyArray<{ value: Theme; label: string; icon: typeof SunIcon }>

// Rendered at the bottom of Настройки: the version comes from the workspace
// package.json via a Vite define (see vite.config.ts / app-version.d.ts), so
// release-please bumps flow through without source edits.
const APP_VERSION = __APP_VERSION__

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { mutate } = useSWRConfig()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const redOrangeThreshold = useSettingsStore((state) => state.redOrangeThreshold)
  const orangeGreenThreshold = useSettingsStore((state) => state.orangeGreenThreshold)
  const setThresholds = useSettingsStore((state) => state.setThresholds)
  const resetThresholds = useSettingsStore((state) => state.resetThresholds)

  const thresholdLegend = [
    { status: 'red' as const, label: `Ниже ${redOrangeThreshold}%` },
    { status: 'orange' as const, label: `${redOrangeThreshold}–${orangeGreenThreshold}%` },
    { status: 'green' as const, label: `${orangeGreenThreshold}% и выше` },
  ]

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      const response = await api.api.v1.auth.logout.$post()

      if (!response.ok) {
        setLogoutError('Не удалось завершить сеанс. Попробуйте ещё раз.')
        return
      }

      // Purge everything the session left on the device: cookies are expired
      // server-side, persisted Zustand stores live in localStorage, and SWR
      // caches are in-memory — so the cookie clear, a full storage clear and
      // a cache-wide drop together start the next session from zero.
      localStorage.clear()
      sessionStorage.clear()
      await mutate(() => true, undefined, { revalidate: false })
      navigate('/auth', { replace: true })
    } catch {
      setLogoutError('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <section aria-labelledby="settings-theme" className="flex flex-col items-start gap-3">
        <h2 id="settings-theme" className="m-0 text-lg font-semibold tracking-[-0.01em]">
          Оформление
        </h2>
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Тема оформления"
          value={[theme]}
          onValueChange={(groupValue) => {
            const selected =
              groupValue.length === 1
                ? THEME_OPTIONS.find((option) => option.value === groupValue[0])
                : undefined

            if (selected !== undefined) {
              setTheme(selected.value)
            }
          }}
        >
          {THEME_OPTIONS.map((option) => {
            const OptionIcon = option.icon

            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                title={option.label}
              >
                <OptionIcon aria-hidden="true" />
                <span className="sr-only">{option.label}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </section>

      <section aria-labelledby="settings-grades" className="flex flex-col items-start gap-3">
        <h2 id="settings-grades" className="m-0 text-lg font-semibold tracking-[-0.01em]">
          Подсветка оценок
        </h2>
        <div
          role="group"
          aria-label="Пороги цвета текущего балла"
          className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-input/60 p-4"
        >
          <Slider
            aria-label="Границы цветовых полос"
            min={0}
            max={100}
            step={1}
            value={[redOrangeThreshold, orangeGreenThreshold]}
            onValueChange={(value) => {
              if (Array.isArray(value) && value.length === 2) {
                setThresholds(value[0], value[1])
              }
            }}
            segments={[
              { from: 0, to: redOrangeThreshold, className: GRADE_BG.red },
              { from: redOrangeThreshold, to: orangeGreenThreshold, className: GRADE_BG.orange },
              { from: orangeGreenThreshold, to: 100, className: GRADE_BG.green },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground tabular-nums">
            {thresholdLegend.map((item) => (
              <span key={item.status} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 rounded-full', GRADE_BG[item.status])}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <Button type="button" variant="outline" onClick={resetThresholds}>
          Сбросить пороги
        </Button>
      </section>

      <section aria-labelledby="settings-session" className="flex flex-col items-start gap-3">
        <h2 id="settings-session" className="m-0 text-lg font-semibold tracking-[-0.01em]">
          Сеанс
        </h2>
        {logoutError !== null && <p className="sr-only">{logoutError}</p>}
        <Button
          type="button"
          variant="destructive"
          disabled={isLoggingOut}
          onClick={() => setConfirmOpen(true)}
        >
          <SignOutIcon aria-hidden="true" />
          Выйти
        </Button>
      </section>

      <LogoutConfirm
        open={confirmOpen}
        isLoggingOut={isLoggingOut}
        error={logoutError}
        onConfirm={() => void handleLogout()}
        onClose={() => setConfirmOpen(false)}
      />

      <p className="mt-2 mb-0 text-xs text-muted-foreground tabular-nums">Версия {APP_VERSION}</p>
    </div>
  )
}

/**
 * The «Выйти» confirmation: a Dialog on desktop and a Drawer on mobile,
 * carrying the retry alert inside so the session-section error text does not
 * shift layout. Cancel returns to the page without touching the session.
 */
function LogoutConfirm({
  open,
  isLoggingOut,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  isLoggingOut: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const isDesktop = useMediaQuery('(min-width: 64rem)')

  const body = (
    <div className="flex flex-col gap-4">
      {error !== null && (
        <Alert variant="destructive">
          <AlertTitle>Не удалось выйти</AlertTitle>
          <AlertDescription>
            <span>{error}</span>
            <Button type="button" variant="outline" className="mt-3" onClick={onConfirm}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoggingOut}>
          Остаться
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={isLoggingOut}>
          <SignOutIcon aria-hidden="true" />
          {isLoggingOut ? 'Выходим…' : 'Выйти'}
        </Button>
      </div>
    </div>
  )

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="gap-y-1">
            <DialogTitle className="text-2xl font-extrabold leading-snug">
              Выйти из аккаунта?
            </DialogTitle>
            <DialogDescription>Это завершит ваш сеанс на этом устройстве.</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer
      open={open}
      showSwipeHandle
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="mb-4">
          <DrawerTitle className="text-2xl font-extrabold leading-snug">
            Выйти из аккаунта?
          </DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}
