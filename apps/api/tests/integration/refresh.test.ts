import { describe, expect, it } from 'bun:test'
import type { Bindings } from '@/env'
import { createApp } from '@/index'
import { compressToken } from '@/lib/token/compressor'
import type { LoginHttpResponse } from '@/shared/schemas/auth.schemas'

const encodeBase64Url = (value: string) =>
  btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')

const createToken = (expiresInSeconds: number) => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = encodeBase64Url(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  )
  return `${header}.${payload}.signature`
}

const allowRateLimit: Bindings['LOGIN_RATE_LIMITER'] = {
  limit: async () => ({ success: true }),
}

const fetchInMemory = (
  testApp: ReturnType<typeof createApp>,
  request: Request,
  rateLimiter = allowRateLimit,
) => {
  const headers = new Headers(request.headers)
  headers.set('cf-connecting-ip', '203.0.113.10')

  return testApp.fetch(new Request(request, { headers }), {
    LOGIN_RATE_LIMITER: rateLimiter,
  })
}

const refreshRequest = async () => {
  const refreshToken = createToken(30 * 24 * 60 * 60)
  const compressed = await compressToken(refreshToken)

  return new Request('http://localhost/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: `Refresh=${compressed}::SM-G950F`,
    },
  })
}

describe('POST /api/v1/auth/refresh integration', () => {
  it('reissues tokens and rotates secure cookies without exposing token values', async () => {
    const tokens: LoginHttpResponse = {
      accessToken: createToken(60 * 60),
      refreshToken: createToken(30 * 24 * 60 * 60),
      applications: [
        {
          organizationGid: 'school-1',
          type: 52,
          url: 'https://sms.astana.nis.edu.kz/jce/Api',
        },
      ],
    }
    const upstreamRequests: Request[] = []
    const testApp = createApp(async (request) => {
      upstreamRequests.push(request.clone())

      if (request.url === 'https://identity.micros.nis.edu.kz/v1/Users/ReissueTokens') {
        return Response.json(tokens)
      }

      if (request.url === 'https://contingent.micros.nis.edu.kz/Api/AdditionalUserInfo') {
        return Response.json({ data: { School: { Gid: 'school-1' } } })
      }

      return Response.json({}, { status: 404 })
    })
    const response = await fetchInMemory(testApp, await refreshRequest())
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(setCookie).toContain('Access=')
    expect(setCookie).toContain('Refresh=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('astana')
    expect(setCookie).not.toContain(tokens.accessToken)
    expect(upstreamRequests).toHaveLength(2)
    expect(upstreamRequests[0]?.method).toBe('POST')
    expect(upstreamRequests[0]?.headers.get('user-agent')).toBe('Dart/3.1 (dart:io)')
    expect(await upstreamRequests[0]?.clone().json()).toMatchObject({
      action: 'v1/Users/ReissueTokens',
      refreshToken: expect.any(String),
      deviceInfo: 'SM-G950F',
    })
    expect(upstreamRequests[1]?.headers.get('authorization')).toBe(`Bearer ${tokens.accessToken}`)
  })

  it('rejects malformed refresh cookies and expires both auth cookies', async () => {
    let upstreamCalls = 0
    const testApp = createApp(async () => {
      upstreamCalls += 1
      return Response.json({})
    })
    const requests = ['Refresh=not-a-valid-cookie', 'Refresh=AAAA::SM-G950F'].map(
      (cookie) =>
        new Request('http://localhost/api/v1/auth/refresh', {
          method: 'POST',
          headers: { cookie },
        }),
    )

    for (const request of requests) {
      const response = await fetchInMemory(testApp, request)
      const setCookie = response.headers.get('set-cookie') ?? ''

      expect(response.status).toBe(401)
      expect(setCookie).toContain('Access=;')
      expect(setCookie).toContain('Refresh=;')
    }

    expect(upstreamCalls).toBe(0)
  })

  it('treats a rejected upstream refresh token as an expired session', async () => {
    const testApp = createApp(async () =>
      Response.json({ message: 'Refresh token expired.' }, { status: 400 }),
    )
    const response = await fetchInMemory(testApp, await refreshRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      success: false,
      errors: { refresh: 'Your session has expired. Please sign in again.' },
    })
    expect(response.headers.get('set-cookie')).toContain('Refresh=;')
  })

  it('rate limits refresh attempts by client IP', async () => {
    const testApp = createApp(async () => Response.json({}))
    const limiter: Bindings['LOGIN_RATE_LIMITER'] = {
      limit: async ({ key }) => ({
        success: key !== 'refresh:203.0.113.10',
      }),
    }
    const response = await fetchInMemory(testApp, await refreshRequest(), limiter)

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
  })
})
