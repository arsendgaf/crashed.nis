import useSWR, { type SWRConfiguration } from 'swr'
import type { ClientResponse } from 'hono/client'
import type { ContentfulStatusCode, SuccessStatusCode } from 'hono/utils/http-status'

export class ApiRpcError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API request failed with status ${status}.`)
    this.name = 'ApiRpcError'
    this.status = status
  }
}

// Hono RPC responses are a union of every documented status payload. Keep only
// the members whose status is a success code so consumers see the shape of the
// successful response alone and never the error payloads.
type ResponseJson<Response> =
  Response extends ClientResponse<unknown, ContentfulStatusCode>
    ? Response extends ClientResponse<infer Payload, infer Status>
      ? Status extends SuccessStatusCode
        ? Payload
        : never
      : never
    : never

export function useApiSWR<Response extends ClientResponse<unknown, ContentfulStatusCode>>(
  key: string | null,
  request: () => Promise<Response>,
  options?: SWRConfiguration<ResponseJson<Response>, Error>,
) {
  return useSWR<ResponseJson<Response>, Error>(
    key,
    async () => {
      const response = await request()

      if (!response.ok) {
        throw new ApiRpcError(response.status)
      }

      // The response union still carries the error payloads at runtime; the
      // filter above guarantees we only ever reach this line on success codes.
      return response.json() as Promise<ResponseJson<Response>>
    },
    {
      shouldRetryOnError: (error) => !(error instanceof ApiRpcError && error.status === 401),
      ...options,
    },
  )
}
