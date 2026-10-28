import { hc } from 'hono/client'
import type { AppType } from '@crashed-nis/api'

export const createApiClient = (fetcher?: typeof fetch) =>
  hc<AppType>('/', {
    init: {
      credentials: 'include',
    },
    fetch: fetcher,
  })

export const api = createApiClient()
