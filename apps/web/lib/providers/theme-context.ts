import { createContext } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// Fast-refresh friendly context module: keeping the context out of the
// provider file lets each file export a single kind of value (components,
// the hook, or this context object).
export const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  setTheme: () => null,
})
