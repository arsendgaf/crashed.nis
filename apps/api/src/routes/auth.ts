import { HTTPError } from 'ky'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import type { Bindings } from '@/env'
import { requireSession } from '@/features/auth/session'
import { refreshNisSession } from '@/features/auth/refresh-token.service'
import { getAdditionalUserInfo } from '@/features/user-info/user-info.service'
import { decompressToken } from '@/lib/token/compressor'
import { issueTokenCookies } from '@/lib/token/issuer'
import { parseCityFromJceUrl } from '@/lib/utils/city'
import { DEFAULT_DEVICE, JCE_APP_TYPE } from '@/shared/config/constants'
import { NIS_ENDPOINTS } from '@/shared/config/endpoints'
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserNotEnrolledError,
} from '@/shared/errors/auth.errors'
import { createNisClient, nisClient, type FetchImplementation } from '@/shared/http/client'
import {
  LoginInputSchema,
  type AuthenticateRequest,
  type LoginHttpResponse,
} from '@/shared/schemas/auth.schemas'

export const createAuthRouter = (fetcher?: FetchImplementation) => {
  const router = new Hono<{ Bindings: Bindings }>()
  const client = fetcher === undefined ? nisClient : createNisClient(fetcher)

  const routes = router
    .get('/session', requireSession, (c) => c.json({ authenticated: true as const }, 200))

    .post(
      '/login',
      zValidator('json', LoginInputSchema, (result, c) => {
        if (!result.success) {
          return c.json(
            {
              success: false as const,
              errors: { iin: 'Provide a valid 12-digit IIN and password.' },
            },
            400,
          )
        }

        return undefined
      }),
      async (c) => {
        try {
          const input = c.req.valid('json')
          const authenticateRequest: AuthenticateRequest = {
            action: 'v1/Users/Authenticate',
            operationId: crypto.randomUUID(),
            username: input.iin,
            password: input.password,
            deviceInfo: DEFAULT_DEVICE,
          }

          let login: LoginHttpResponse
          try {
            login = await client
              .post(NIS_ENDPOINTS.identity, { json: authenticateRequest })
              .json<LoginHttpResponse>()
          } catch (error) {
            if (error instanceof HTTPError && error.response.status === 400) {
              throw new InvalidCredentialsError()
            }

            throw error
          }

          const userInfo = await getAdditionalUserInfo(client, login.accessToken)
          const schoolId = userInfo?.data?.School?.Gid
          const application = login.applications?.find(
            (candidate) =>
              candidate?.organizationGid === schoolId && candidate?.type === JCE_APP_TYPE,
          )

          if (application?.url === undefined) {
            throw new UserNotEnrolledError()
          }

          const city = parseCityFromJceUrl(application.url)
          const cookies = await issueTokenCookies(login, city)

          setCookie(c, 'Access', cookies.access.value, cookies.access.options)
          setCookie(c, 'Refresh', cookies.refresh.value, cookies.refresh.options)

          return c.json({ success: true as const }, 200)
        } catch (error) {
          if (error instanceof InvalidCredentialsError) {
            return c.json(
              {
                success: false as const,
                errors: { password: error.message },
              },
              400,
            )
          }

          if (error instanceof UserNotEnrolledError) {
            return c.json(
              {
                success: false as const,
                errors: { iin: error.message },
              },
              400,
            )
          }

          return serviceError(c)
        }
      },
    )

    .post('/refresh', async (c) => {
      const refreshCookie = parseRefreshCookie(getCookie(c, 'Refresh'))

      if (refreshCookie === null) {
        clearAuthCookies(c)
        return invalidRefreshResponse(c)
      }

      try {
        let refreshToken: string

        try {
          refreshToken = await decompressToken(refreshCookie.compressedToken)
        } catch {
          throw new InvalidRefreshTokenError()
        }

        const session = await refreshNisSession(client, refreshToken, refreshCookie.deviceInfo)
        const cookies = await issueTokenCookies(session.tokens, session.city)

        setCookie(c, 'Access', cookies.access.value, cookies.access.options)
        setCookie(c, 'Refresh', cookies.refresh.value, cookies.refresh.options)

        return c.json({ success: true as const }, 200)
      } catch (error) {
        if (
          error instanceof InvalidRefreshTokenError ||
          (error instanceof HTTPError &&
            (error.response.status === 400 || error.response.status === 401))
        ) {
          clearAuthCookies(c)
          return invalidRefreshResponse(c)
        }

        if (error instanceof UserNotEnrolledError) {
          return c.json(
            {
              success: false as const,
              errors: { refresh: error.message },
            },
            403,
          )
        }

        console.error(
          JSON.stringify({
            message: 'NIS token refresh failed.',
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }),
        )
        return c.json(
          {
            success: false as const,
            errors: { refresh: 'Unable to refresh your session. Please try again later.' },
          },
          502,
        )
      }
    })

    .post('/logout', (c) => {
      clearAuthCookies(c)
      return c.json({ success: true as const }, 200)
    })

  return routes
}

export const authRouter = createAuthRouter()

function serviceError(c: import('hono').Context<{ Bindings: Bindings }>) {
  return c.json(
    {
      success: false as const,
      errors: {
        password: 'An unexpected error occurred on the NIS service side. Please try again later.',
      },
    },
    500,
  )
}

function parseRefreshCookie(value: string | undefined) {
  if (value === undefined || value.length > 4096) {
    return null
  }

  const parts = value.split('::')

  if (
    parts.length !== 2 ||
    parts[0] === undefined ||
    !/^[A-Za-z0-9_-]+$/u.test(parts[0]) ||
    parts[1] === undefined ||
    !/^[A-Za-z0-9._-]{1,64}$/u.test(parts[1])
  ) {
    return null
  }

  return { compressedToken: parts[0], deviceInfo: parts[1] }
}

function clearAuthCookies(c: import('hono').Context<{ Bindings: Bindings }>) {
  const options = {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax' as const,
    secure: true,
  }

  deleteCookie(c, 'Access', options)
  deleteCookie(c, 'Refresh', options)
}

function invalidRefreshResponse(c: import('hono').Context<{ Bindings: Bindings }>) {
  return c.json(
    {
      success: false as const,
      errors: { refresh: 'Your session has expired. Please sign in again.' },
    },
    401,
  )
}
