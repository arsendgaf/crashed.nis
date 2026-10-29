import { describe, expect, it } from 'vitest'
import { createApp } from '@/index'
import { compressToken } from '@/lib/token/compressor'
import type { Journal, Reports, RubricInfo } from '@/shared/schemas/auth.schemas'

const encodeBase64Url = (value: string) =>
  btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')

const createAccessToken = (expiresInSeconds = 60 * 60) => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = encodeBase64Url(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      UserInfo: JSON.stringify({
        PersonGid: 'student-1',
        FirstName: 'Ada',
        SecondName: 'Lovelace',
      }),
    }),
  )
  return `${header}.${payload}.signature`
}

const accessCookieFor = async (token: string) => {
  const compressed = await compressToken(token)
  return `Access=${compressed}::ast`
}

const accessCookie = async (expiresInSeconds?: number) =>
  accessCookieFor(createAccessToken(expiresInSeconds))

const testApp = (fetcher: (request: Request) => Promise<Response>) => createApp(fetcher)

const fetchWithCookie = (app: ReturnType<typeof createApp>, path: string, cookie: string) =>
  app.fetch(
    new Request(`http://localhost${path}`, {
      headers: { cookie },
    }),
  )

describe('authenticated data API integration', () => {
  it('confirms a valid access session', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await fetchWithCookie(app, '/api/v1/auth/session', await accessCookie())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ authenticated: true })
  })

  it('rejects a missing access session check', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await app.fetch(new Request('http://localhost/api/v1/auth/session'))

    expect(response.status).toBe(401)
  })

  it('rejects requests without a valid access session', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await app.fetch(new Request('http://localhost/api/v1/journal'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      message: 'Unauthorized',
      cause: 'Access token is either invalid or expired',
    })
  })

  it('keeps unversioned data routes as compatibility aliases', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await app.fetch(new Request('http://localhost/api/journal'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      message: 'Unauthorized',
      cause: 'Access token is either invalid or expired',
    })
  })

  it('returns contingent info with the names embedded in the access token', async () => {
    let upstreamRequest: Request | undefined
    const app = testApp(async (request) => {
      upstreamRequest = request.clone()
      return Response.json({
        success: true,
        data: {
          Klass: '12Q',
          School: { Gid: 'school-1' },
        },
        legacyField: 'preserved',
      })
    })
    const accessToken = createAccessToken()
    const response = await fetchWithCookie(
      app,
      '/api/v1/contingent',
      await accessCookieFor(accessToken),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: {
        Klass: '12Q',
        School: { Gid: 'school-1' },
      },
      legacyField: 'preserved',
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    expect(upstreamRequest?.url).toBe('https://contingent.micros.nis.edu.kz/Api/AdditionalUserInfo')
    expect(upstreamRequest?.headers.get('authorization')).toBe(`Bearer ${accessToken}`)
  })

  it('fetches the student journal for the city stored in the access cookie', async () => {
    const journal: Journal = [
      { number: 1, subjects: [] },
      { number: 2, subjects: [] },
      { number: 3, subjects: [] },
      { number: 4, subjects: [] },
    ]
    let upstreamRequest: Request | undefined
    const app = testApp(async (request) => {
      upstreamRequest = request.clone()
      return Response.json(journal)
    })
    const response = await fetchWithCookie(app, '/api/v1/journal', await accessCookie())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(journal)
    expect(upstreamRequest?.url).toBe(
      'https://sms.ast.nis.edu.kz/jce/Api/Api/GetSubjectsAndPeriods',
    )
    expect(await upstreamRequest?.clone().json()).toMatchObject({
      action: 'Api/GetSubjectsAndPeriods',
      studentId: 'student-1',
    })
  })

  it('validates rubric quarter and forwards subject, student, and period', async () => {
    const rubric: RubricInfo = {
      sumChapterCriteria: [],
      sumQuarterCriteria: [],
    }
    let upstreamRequest: Request | undefined
    const app = testApp(async (request) => {
      upstreamRequest = request.clone()
      return Response.json(rubric)
    })
    const cookie = await accessCookie()
    const invalidResponse = await fetchWithCookie(
      app,
      '/api/v1/journal/subject-1?quarter=5',
      cookie,
    )
    const response = await fetchWithCookie(app, '/api/v1/journal/subject-1?quarter=3', cookie)

    expect(invalidResponse.status).toBe(400)
    expect(upstreamRequest?.url).toBe(
      'https://sms.ast.nis.edu.kz/jce/Api/Api/GetDataBySectionAndByPeriod',
    )
    expect(await upstreamRequest?.clone().json()).toMatchObject({
      studentId: 'student-1',
      subjectId: 'subject-1',
      periodIndex: 3,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(rubric)
  })

  it('maps a missing upstream subject to 404', async () => {
    const app = testApp(async () =>
      Response.json({ message: 'Предмет не найден' }, { status: 400 }),
    )
    const response = await fetchWithCookie(
      app,
      '/api/v1/journal/subject-missing?quarter=1',
      await accessCookie(),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      message: 'Not found',
      cause: 'Subject with id subject-missing not found',
    })
  })

  it('fetches report cards for the authenticated student', async () => {
    const reports: Reports = []
    let upstreamRequest: Request | undefined
    const app = testApp(async (request) => {
      upstreamRequest = request.clone()
      return Response.json(reports)
    })
    const response = await fetchWithCookie(app, '/api/v1/reports', await accessCookie())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(reports)
    expect(upstreamRequest?.url).toBe(
      'https://reportcard.micros.nis.edu.kz/v1/ReportCard/GetAllReportCardsAsync',
    )
    expect(await upstreamRequest?.clone().json()).toMatchObject({
      action: 'v1/ReportCard/GetAllReportCardsAsync',
      studentId: 'student-1',
    })
  })

  it('expires both cookies on logout', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await app.fetch(
      new Request('http://localhost/api/v1/auth/logout', { method: 'POST' }),
    )
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(setCookie).toContain('Access=;')
    expect(setCookie).toContain('Refresh=;')
  })

  it('rejects expired access tokens', async () => {
    const app = testApp(async () => Response.json({}))
    const response = await fetchWithCookie(app, '/api/v1/reports', await accessCookie(-1))

    expect(response.status).toBe(401)
  })

  it('accepts the legacy bearer form of the access cookie', async () => {
    const app = testApp(async () => Response.json([]))
    const cookie = await accessCookie()
    const response = await app.fetch(
      new Request('http://localhost/api/v1/reports', {
        headers: { authorization: `Bearer ${cookie.slice('Access='.length)}` },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
