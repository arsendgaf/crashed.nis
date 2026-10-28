import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import type { ApiResponse } from '@crashed-nis/types'
import type { Bindings } from './env'
import { createAuthRouter } from './routes/auth'
import { createDataRouter } from './routes/data'
import { LoginInputSchema } from './shared/schemas/auth.schemas'

const FRONTEND_ORIGINS = ['https://crashed.nis.edu.kz', 'http://localhost:5173'] as const

export const createApp = (fetcher?: Parameters<typeof createAuthRouter>[0]) => {
  const app = new OpenAPIHono<{ Bindings: Bindings }>()

  app.use(
    '*',
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
    }),
  )

  app.use(
    '*',
    cors({
      origin: [...FRONTEND_ORIGINS],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  const rateLimitAuth =
    (action: 'login' | 'refresh') =>
    async (
      c: import('hono').Context<{
        Bindings: Bindings
      }>,
      next: () => Promise<void>,
    ) => {
      const ipAddress = c.req.header('cf-connecting-ip')

      if (ipAddress === undefined) {
        return c.json(
          {
            success: false as const,
            errors: { request: 'A client IP address is required.' },
          },
          403,
        )
      }

      const { success } = await c.env.LOGIN_RATE_LIMITER.limit({
        key: `${action}:${ipAddress}`,
      })

      if (!success) {
        c.header('Retry-After', '60')
        return c.json(
          {
            success: false as const,
            errors: { request: `Too many ${action} attempts. Please try again later.` },
          },
          429,
        )
      }

      await next()
      return
    }

  app.use('/api/v1/auth/login', rateLimitAuth('login'))
  app.use('/api/v1/auth/refresh', rateLimitAuth('refresh'))

  app.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) {
      return c.json(
        {
          success: false as const,
          errors: { iin: 'Provide a valid JSON login request.' },
        },
        400,
      )
    }

    return c.json(
      {
        success: false as const,
        errors: { request: 'An unexpected error occurred.' },
      },
      500,
    )
  })

  const apiHealth = (c: import('hono').Context<{ Bindings: Bindings }>) => {
    const response: ApiResponse<{ status: 'ok' }> = {
      data: { status: 'ok' },
    }
    return c.json(response)
  }

  const dataRouter = createDataRouter(fetcher)
  const apiApp = app
    .route('/api/v1/auth', createAuthRouter(fetcher))
    .route('/api/v1', dataRouter)
    .route('/api', dataRouter)
    .get('/api/v1/health', apiHealth)
    .get('/api/health', apiHealth)
    .get('/health', (c) => c.json({ status: 'ok' }))

  app.openAPIRegistry.registerComponent('securitySchemes', 'AccessCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'Access',
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'RefreshCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'Refresh',
  })
  registerOpenApiRoutes(app)

  const openApiDocument = {
    openapi: '3.1.0',
    info: {
      title: 'API Reference',
      version: '1.0.0',
      description: 'Public API documentation powered by Scalar',
    },
    servers: [{ url: '/', description: 'Current API origin' }],
  }

  app.doc31('/openapi.json', openApiDocument)
  app.doc31('/api/openapi.json', openApiDocument)

  app.notFound((c) => {
    const response: ApiResponse<never> = {
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    }
    return c.json(response, 404)
  })

  return apiApp
}

function registerOpenApiRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  const emptyJsonObject = z.object({}).passthrough()

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/auth/session',
      summary: 'Check the current session',
      description: 'Returns whether the access cookie contains a valid, unexpired session.',
      security: [{ AccessCookie: [] }],
      responses: {
        200: {
          description: 'The current access session is valid.',
          content: {
            'application/json': {
              schema: z.object({ authenticated: z.literal(true) }),
            },
          },
        },
        401: { description: 'Authentication required.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/login',
      summary: 'Log in',
      description: 'Authenticate with an IIN and password. Sets access and refresh cookies.',
      request: {
        body: {
          required: true,
          content: {
            'application/json': { schema: LoginInputSchema },
          },
        },
      },
      responses: {
        200: {
          description: 'Authentication succeeded.',
          content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
        },
        400: { description: 'Invalid credentials or request.' },
        500: { description: 'Authentication service failure.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/refresh',
      summary: 'Refresh session',
      description: 'Refreshes the session using the refresh cookie and rotates auth cookies.',
      security: [{ RefreshCookie: [] }],
      responses: {
        200: { description: 'Session refreshed.' },
        401: { description: 'Refresh token is missing, invalid, or expired.' },
        502: { description: 'Authentication service failure.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/logout',
      summary: 'Log out',
      description: 'Expires the access and refresh cookies.',
      responses: {
        200: { description: 'Auth cookies expired.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/contingent',
      summary: 'Get contingent information',
      security: [{ AccessCookie: [] }],
      responses: {
        200: {
          description: 'Contingent information for the current student.',
          content: { 'application/json': { schema: emptyJsonObject } },
        },
        401: { description: 'Authentication required.' },
        503: { description: 'NIS service is unavailable.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/journal',
      summary: 'Get journal',
      security: [{ AccessCookie: [] }],
      responses: {
        200: {
          description: 'Journal for the current student.',
          content: { 'application/json': { schema: emptyJsonObject } },
        },
        401: { description: 'Authentication required.' },
        503: { description: 'NIS service is unavailable.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/journal/{subject}',
      summary: 'Get subject rubric',
      security: [{ AccessCookie: [] }],
      request: {
        params: z.object({
          subject: z.string().openapi({
            param: { name: 'subject', in: 'path' },
            description: 'Subject identifier.',
          }),
        }),
        query: z.object({
          quarter: z.enum(['1', '2', '3', '4']).openapi({
            param: { name: 'quarter', in: 'query' },
            description: 'Quarter number.',
          }),
        }),
      },
      responses: {
        200: {
          description: 'Rubric for the subject.',
          content: { 'application/json': { schema: emptyJsonObject } },
        },
        400: { description: 'Invalid quarter or subject identifier.' },
        401: { description: 'Authentication required.' },
        404: { description: 'Subject not found.' },
        503: { description: 'NIS service is unavailable.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/reports',
      summary: 'Get report cards',
      security: [{ AccessCookie: [] }],
      responses: {
        200: {
          description: 'Report cards for the current student.',
          content: { 'application/json': { schema: emptyJsonObject } },
        },
        401: { description: 'Authentication required.' },
        503: { description: 'NIS service is unavailable.' },
      },
    }),
  )

  app.openAPIRegistry.registerPath(
    createRoute({
      method: 'get',
      path: '/api/v1/health',
      summary: 'API health check',
      responses: {
        200: {
          description: 'The API is healthy.',
          content: {
            'application/json': {
              schema: z.object({
                data: z.object({ status: z.literal('ok') }),
              }),
            },
          },
        },
      },
    }),
  )
}

const app = createApp()

export { app }
export type AppType = typeof app
export default app
