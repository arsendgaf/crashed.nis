import type { PropsWithChildren } from 'react'
import { SWRConfig } from 'swr'
import { ApiRpcError } from '@/lib/api/use-api-swr'
import { ThemeProvider } from '@/lib/providers/theme-provider'

const Providers = ({ children }: PropsWithChildren) => (
  <SWRConfig
    value={{
      errorRetryCount: 3,
      revalidateOnFocus: true,
      onErrorRetry: (error, _key, config, revalidate, { retryCount }) => {
        if (error instanceof ApiRpcError && error.status < 500) {
          return
        }

        if (retryCount >= 3) {
          return
        }

        setTimeout(() => revalidate({ retryCount }), config.errorRetryInterval)
      },
    }}
  >
    <ThemeProvider>{children}</ThemeProvider>
  </SWRConfig>
)

export default Providers
