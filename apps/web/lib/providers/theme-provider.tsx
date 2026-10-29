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

// While a modal is open the tint follows the modal surface color
// (--popover, the color the Dialog/Drawer sheet panels are painted with)
// instead of the navigation bar: the panel floats inset with rounded
// edges, and Safari samples the sheet itself at the bottom edge, so the
// chrome must match the sheet, not the page behind it.

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

      // Safari also samples the open sheet itself (the drawer popup is fixed
      // at the bottom edge with bg-popover), so the tint must be the popover
      // surface: in light themes popover === background (plain white), in
      // dark themes popover is the actual modal sheet color, keeping top and
      // bottom chrome identical to the sheet.
      const modalColor = window.getComputedStyle(root).getPropertyValue('--popover').trim()
      const tint = modalOpen && modalColor !== '' ? modalColor : navigationColor

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
