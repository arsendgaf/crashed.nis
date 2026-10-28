import type { KyInstance } from 'ky'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Bindings } from '@/env'
import { requireSession, type SessionVariables } from '@/features/auth/session'
import { getAdditionalUserInfo } from '@/features/user-info/user-info.service'
import {
  getJournal,
  getJournalRubric,
  getReports,
} from '@/features/student-data/student-data.service'
import type { RubricInfo } from '@/shared/schemas/auth.schemas'
import { createNisClient, nisClient, type FetchImplementation } from '@/shared/http/client'
import { z } from 'zod'

type DataRouterEnv = {
  Bindings: Bindings
  Variables: SessionVariables
}

export const createDataRouter = (fetcher?: FetchImplementation) => {
  const router = new Hono<DataRouterEnv>()
  const client: KyInstance = fetcher === undefined ? nisClient : createNisClient(fetcher)

  router.use('/contingent', requireSession)
  router.use('/journal', requireSession)
  router.use('/journal/*', requireSession)
  router.use('/reports', requireSession)

  const routes = router
    .get('/contingent', async (c) => {
      const session = c.get('session')

      try {
        const userInfo = await getAdditionalUserInfo(client, session.accessToken)
        return c.json({
          ...userInfo,
          firstName: session.userInfo.FirstName,
          lastName: session.userInfo.SecondName,
        })
      } catch (error) {
        return upstreamFailure(c, 'contingent', error)
      }
    })

    .get('/journal', async (c) => {
      const session = c.get('session')

      try {
        const journal = await getJournal(
          client,
          session.accessToken,
          session.userInfo.PersonGid,
          session.city,
        )
        return c.json(journal)
      } catch (error) {
        return upstreamFailure(c, 'journal', error)
      }
    })

    .get(
      '/journal/:subject',
      zValidator(
        'query',
        z.object({
          quarter: z.coerce.number().int().min(1).max(4),
        }),
        (result, c) => {
          if (!result.success) {
            return c.json(
              {
                message: 'Bad request',
                cause: 'Quarter index (quarter search param) must be between 1 and 4.',
              },
              400,
            )
          }

          return undefined
        },
      ),
      async (c) => {
        const subjectId = c.req.param('subject')

        if (!/^[A-Za-z0-9_-]{1,128}$/u.test(subjectId)) {
          return c.json({ message: 'Bad request', cause: 'The subject id is invalid.' }, 400)
        }

        const session = c.get('session')
        const { quarter } = c.req.valid('query')

        try {
          const upstreamResponse = await getJournalRubric(
            client,
            session.accessToken,
            session.userInfo.PersonGid,
            session.city,
            subjectId,
            quarter,
          )

          if (!upstreamResponse.ok) {
            if (await isSubjectNotFound(upstreamResponse)) {
              return c.json(
                {
                  message: 'Not found',
                  cause: `Subject with id ${subjectId} not found`,
                },
                404,
              )
            }

            return upstreamFailure(
              c,
              'journal-rubric',
              new Error(`Upstream returned status ${upstreamResponse.status}.`),
            )
          }

          const rubric = await upstreamResponse.json<RubricInfo>()
          return c.json(rubric)
        } catch (error) {
          return upstreamFailure(c, 'journal-rubric', error)
        }
      },
    )

    .get('/reports', async (c) => {
      const session = c.get('session')

      try {
        const reports = await getReports(client, session.accessToken, session.userInfo.PersonGid)
        return c.json(reports)
      } catch (error) {
        return upstreamFailure(c, 'reports', error)
      }
    })

  return routes
}

async function isSubjectNotFound(response: Response): Promise<boolean> {
  if (response.status === 404) {
    return true
  }

  if (response.status !== 400) {
    return false
  }

  try {
    const body: unknown = await response.json()

    if (typeof body !== 'object' || body === null || !('message' in body)) {
      return false
    }

    const message = body.message
    return typeof message === 'string' && message.toLowerCase().startsWith('предмет не найден')
  } catch {
    return false
  }
}

function upstreamFailure(
  c: import('hono').Context<DataRouterEnv>,
  endpoint: string,
  error: unknown,
) {
  console.error(
    JSON.stringify({
      message: 'NIS data request failed.',
      endpoint,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }),
  )

  return c.json(
    {
      message: 'Service unavailable',
      cause: 'NIS services are temporarily unavailable. Please try again later.',
    },
    503,
  )
}
