import { describe, expect, it } from 'vitest'
import type { Bindings } from '@/env'
import { createApp } from '@/index'
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

const createTestApp = (fetcher: (request: Request) => Promise<Response>) => createApp(fetcher)

const fetchInMemory = (
  testApp: ReturnType<typeof createApp>,
  request: Request,
  rateLimiter = allowRateLimit,
  ipAddress = '203.0.113.10',
) => {
  const headers = new Headers(request.headers)
  headers.set('cf-connecting-ip', ipAddress)

  return testApp.fetch(new Request(request, { headers }), {
    LOGIN_RATE_LIMITER: rateLimiter,
  })
}

describe('POST /api/v1/auth/login integration', () => {
  it('rejects malformed payloads without making upstream requests', async () => {
    const testApp = createTestApp(async () => Response.json({}))
    const response = await fetchInMemory(
      testApp,
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iin: '123', password: '' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      errors: { iin: 'Provide a valid 12-digit IIN and password.' },
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects invalid JSON bodies', async () => {
    const testApp = createTestApp(async () => Response.json({}))
    const response = await fetchInMemory(
      testApp,
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      errors: { iin: 'Provide a valid JSON login request.' },
    })
  })

  it('accepts a valid payload and maps rejected credentials', async () => {
    const testApp = createTestApp(async () => Response.json({}, { status: 400 }))
    const response = await fetchInMemory(
      testApp,
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iin: '123456789012', password: 'samplePassword' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      errors: { password: 'Invalid IIN or password.' },
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('handles a missing optional School.Gid without crashing', async () => {
    const login: LoginHttpResponse = {
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
    const testApp = createTestApp(async (request) =>
      request.url === 'https://identity.micros.nis.edu.kz/v1/Users/Authenticate'
        ? Response.json(login)
        : Response.json({ additionalLegacyField: 'ignored' }),
    )
    const response = await fetchInMemory(
      testApp,
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iin: '123456789012', password: 'samplePassword' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      errors: {
        iin: 'Account found, but you are not enrolled in any NIS branch. You may be using a parent account.',
      },
    })
  })

  it('sets secure cookies after successful authentication', async () => {
    const login: LoginHttpResponse = {
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
    const testApp = createTestApp(async (request) => {
      upstreamRequests.push(request.clone())

      if (request.url === 'https://identity.micros.nis.edu.kz/v1/Users/Authenticate') {
        return Response.json({
          ...login,
          extraLegacyField: 'ignored',
          applications: login.applications?.map((application) => ({
            ...application,
            legacyApplicationMetadata: { enabled: true },
          })),
        })
      }

      if (request.url === 'https://contingent.micros.nis.edu.kz/Api/AdditionalUserInfo') {
        return Response.json({
          success: true,
          data: { School: { Gid: 'school-1', Name: { en: 'Example School' } }, Klass: '12Q' },
          message: '',
          StatusCode: 200,
          additionalLegacyField: 'ignored',
        })
      }

      return Response.json({}, { status: 404 })
    })
    const response = await fetchInMemory(
      testApp,
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iin: '123456789012', password: 'samplePassword' }),
      }),
    )
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(setCookie).toContain('Access=')
    expect(setCookie).toContain('Refresh=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Lax')
    expect(setCookie).toContain('Max-Age=3600')
    expect(setCookie).toContain('Max-Age=2592000')
    expect(setCookie).toContain('astana')
    expect(upstreamRequests).toHaveLength(2)
    expect(upstreamRequests[0]?.headers.get('user-agent')).toBe('Dart/3.1 (dart:io)')
    expect(upstreamRequests[0]?.headers.get('cookie')).toBe('Culture=ru-RU;')
    expect(await upstreamRequests[0]?.clone().json()).toMatchObject({
      username: '123456789012',
      password: 'samplePassword',
      deviceInfo: 'SM-G950F',
    })
    expect(upstreamRequests[1]?.headers.get('authorization')).toBe(`Bearer ${login.accessToken}`)
    expect(await upstreamRequests[1]?.clone().json()).toMatchObject({
      applicationType: 'ContingentAPI',
      action: 'Api/AdditionalUserInfo',
    })
  })

  it('limits each client IP to five login attempts per minute', async () => {
    const testApp = createTestApp(async () => Response.json({}, { status: 400 }))
    const attempts = new Map<string, number>()
    const limiter: Bindings['LOGIN_RATE_LIMITER'] = {
      limit: async ({ key }) => {
        const count = (attempts.get(key) ?? 0) + 1
        attempts.set(key, count)
        return { success: count <= 5 }
      },
    }
    const makeLoginRequest = () =>
      new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iin: '123456789012', password: 'samplePassword' }),
      })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetchInMemory(testApp, makeLoginRequest(), limiter)
      expect(response.status).toBe(400)
    }

    const limitedResponse = await fetchInMemory(testApp, makeLoginRequest(), limiter)

    expect(limitedResponse.status).toBe(429)
    expect(limitedResponse.headers.get('retry-after')).toBe('60')
    expect(attempts.get('login:203.0.113.10')).toBe(6)

    const otherIpResponse = await fetchInMemory(
      testApp,
      makeLoginRequest(),
      limiter,
      '203.0.113.11',
    )
    expect(otherIpResponse.status).toBe(400)
    expect(attempts.get('login:203.0.113.11')).toBe(1)
  })
})
