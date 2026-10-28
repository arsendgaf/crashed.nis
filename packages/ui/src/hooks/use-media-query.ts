import { useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query. Returns `true` while the query matches.
 * Reads through `useSyncExternalStore` so the value is always in sync
 * and tearing-free without effect-based state.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onStoreChange: () => void) => {
    const mediaQueryList = window.matchMedia(query)
    mediaQueryList.addEventListener('change', onStoreChange)

    return () => mediaQueryList.removeEventListener('change', onStoreChange)
  }

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
