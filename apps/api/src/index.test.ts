import { describe, expect, it } from 'vitest'
import { app } from './index'

describe('API worker', () => {
  it('returns the Bruno health-check response', async () => {
    const response = await app.fetch(
      new Request('http://localhost/health', {
        headers: { Origin: 'http://localhost:5173' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('does not allow unconfigured cross-origin requests', async () => {
    const response = await app.fetch(
      new Request('http://localhost/health', {
        headers: { Origin: 'https://attacker.example' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('returns a JSON health response', async () => {
    const response = await app.fetch(new Request('http://localhost/api/v1/health'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ data: { status: 'ok' } })
  })

  it('keeps the unversioned health route as a compatibility alias', async () => {
    const response = await app.fetch(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { status: 'ok' } })
  })

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await app.fetch(new Request('http://localhost/api/missing'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    })
  })

  it('serves the OpenAPI 3.1 document with documented API routes', async () => {
    const response = await app.fetch(new Request('http://localhost/openapi.json'))
    const document = (await response.json()) as {
      openapi: string
      info: { title: string; version: string; description: string }
      servers: { url: string; description: string }[]
      paths: Record<string, unknown>
    }

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(document.openapi).toBe('3.1.0')
    expect(document.info).toEqual({
      title: 'API Reference',
      version: '1.0.0',
      description: 'Public API documentation powered by Scalar',
    })
    expect(document.servers).toEqual([{ url: '/', description: 'Current API origin' }])
    expect(document.paths['/api/v1/auth/login']).toBeDefined()
    expect(document.paths['/api/v1/auth/session']).toBeDefined()
    expect(document.paths['/api/v1/journal/{subject}']).toBeDefined()
    expect(document.paths['/api/v1/health']).toBeDefined()
    expect(Object.keys(document.paths).every((path) => path.startsWith('/api/v1/'))).toBe(true)
    expect(document.paths['/health']).toBeUndefined()
  })

  it('serves the OpenAPI document through the frontend API path', async () => {
    const response = await app.fetch(new Request('http://localhost/api/openapi.json'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toMatchObject({
      openapi: '3.1.0',
      paths: {
        '/api/v1/auth/login': expect.any(Object),
        '/api/v1/health': expect.any(Object),
      },
    })
  })
})
