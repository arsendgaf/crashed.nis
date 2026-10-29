import { createContext, useContext, useLayoutEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Base UI decorates open overlays with data-open on elements whose data-slot
// is prefixed "dialog" or "drawer" (the only two shells that dim the page);
// menus, popovers, tooltips and selects use other prefixes, so they never
// flip the status-bar color.
const MODAL_SELECTOR = '[data-slot^="dialog"][data-open], [data-slot^="drawer"][data-open]'

// While a modal is open the page sits under a bg-black/80 overlay, so the
// backdrop the browser should match is the navigation color blended 80%
// toward black.
const MODAL_OVERLAY_DARKNESS = 0.8

// Resolve any CSS color through the browser's own parser and blend it toward
// black, returning a plain hex string (theme-color meta does not support
// color-mix() or var()). The single probe element lives in <head>, outside
// the body subtree the mutation observer watches, so resolving a color never
// re-triggers the observer.
let colorProbe: HTMLSpanElement | null = null

const resolveComputedColor = (color: string): string => {
  if (colorProbe === null) {
    colorProbe = document.createElement('span')
    document.head.appendChild(colorProbe)
  }

  colorProbe.style.backgroundColor = color
  return getComputedStyle(colorProbe).backgroundColor
}

const mixTowardBlack = (color: string, amount: number): string | null => {
  const match = resolveComputedColor(color).match(/rgba?\(([^)]+)\)/)
  if (!match) return null

  const channels = match[1].split(',').slice(0, 3).map(Number)
  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null

  return `#${channels
    .map((channel) =>
      Math.round(channel * (1 - amount))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  )

  useLayoutEffect(() => {
    const root = window.document.documentElement
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const themeColor = window.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    // Keep the UI tint in sync with both the resolved theme and modal state:
    // normally it follows the navigation bar color, under an open dialog or
    // drawer it follows the darkened backdrop instead. The key check keeps
    // each (theme color, modal state) pair to a single write: real mutations
    // (React renders, Base UI toggles) cost one cheap compare, and any stray
    // self-induced mutation cannot ping-pong into an endless loop.
    let lastSyncKey: string | null = null

    const syncThemeColor = () => {
      const navigationColor = window.getComputedStyle(root).getPropertyValue('--sidebar').trim()
      if (navigationColor === '') return

      const modalOpen = document.querySelector(MODAL_SELECTOR) !== null
      const key = `${navigationColor}|${modalOpen ? 'modal' : 'nav'}`
      if (key === lastSyncKey) return
      lastSyncKey = key

      const tint = modalOpen
        ? (mixTowardBlack(navigationColor, MODAL_OVERLAY_DARKNESS) ?? navigationColor)
        : navigationColor

      // Two tint sources for two engine generations: Safari 26+ ignores
      // theme-color and live-samples the body's background-color instead,
      // while Chrome, Firefox and Safari ≤ 18.6 still read the meta tag.
      if (themeColor !== null) {
        themeColor.content = tint
      }
      document.body.style.backgroundColor = tint
    }

    const applyTheme = () => {
      root.classList.remove('light', 'dark')
      root.classList.add(theme === 'system' ? (colorScheme.matches ? 'dark' : 'light') : theme)

      syncThemeColor()
    }

    applyTheme()

    // Portaled dialogs and drawers appear as childList mutations under body;
    // Base UI toggles data-open/data-closed in place while they animate.
    const modalObserver = new MutationObserver(syncThemeColor)
    modalObserver.observe(window.document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-open', 'data-closed'],
    })

    colorScheme.addEventListener('change', applyTheme)

    return () => {
      modalObserver.disconnect()
      colorScheme.removeEventListener('change', applyTheme)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
