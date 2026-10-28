import ky from 'ky'

export type FetchImplementation = (input: Request, init?: RequestInit) => Promise<Response>

const createClient = (fetcher?: FetchImplementation) =>
  ky.create({
    timeout: 30_000,
    retry: {
      limit: 2,
      methods: ['get', 'post'],
      statusCodes: [408, 500, 502, 503, 504],
    },
    headers: {
      'User-Agent': 'Dart/3.1 (dart:io)',
      Cookie: 'Culture=ru-RU;',
    },
    ...(fetcher === undefined ? {} : { fetch: fetcher }),
  })

export const nisClient = createClient()
export const createNisClient = createClient
