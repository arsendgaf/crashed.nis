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

    const applyTheme = () => {
      const resolvedTheme = theme === 'system' ? (colorScheme.matches ? 'dark' : 'light') : theme

      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)

      const navigationColor = window.getComputedStyle(root).getPropertyValue('--sidebar').trim()

      if (themeColor !== null && navigationColor !== '') {
        themeColor.content = navigationColor
      }
    }

    applyTheme()

    if (theme === 'system') {
      colorScheme.addEventListener('change', applyTheme)
      return () => colorScheme.removeEventListener('change', applyTheme)
    }

    return undefined
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
