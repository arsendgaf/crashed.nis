import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { decompressToken } from '@/lib/token/compressor'
import { decodeJwtPayload } from '@/lib/token/jwt'
import type { UserInfoClaims } from '@/shared/schemas/auth.schemas'

export interface ApiSession {
  readonly accessToken: string
  readonly city: string
  readonly userInfo: UserInfoClaims & { readonly PersonGid: string }
}

export interface SessionVariables {
  session: ApiSession
}

type ParsedUserInfo = UserInfoClaims & { readonly PersonGid: string }

const MAX_ACCESS_COOKIE_LENGTH = 4096
const CITY_CODE_PATTERN = /^[a-z0-9-]{1,32}$/u

export const requireSession: MiddlewareHandler<{
  Variables: SessionVariables
}> = async (c, next) => {
  const session = await resolveSession(c)

  if (session === null) {
    return c.json(
      {
        message: 'Unauthorized',
        cause: 'Access token is either invalid or expired',
      },
      401,
    )
  }

  c.set('session', session)
  return await next()
}

async function resolveSession(c: Context): Promise<ApiSession | null> {
  const authorization = c.req.header('Authorization')
  const accessValue =
    authorization === undefined ? getCookie(c, 'Access') : parseBearerToken(authorization)

  if (accessValue === undefined || accessValue.length > MAX_ACCESS_COOKIE_LENGTH) {
    return null
  }

  const parts = accessValue.split('::')
  const [compressedToken, city] = parts

  if (
    parts.length !== 2 ||
    compressedToken === undefined ||
    !/^[A-Za-z0-9_-]+$/u.test(compressedToken) ||
    city === undefined ||
    !CITY_CODE_PATTERN.test(city)
  ) {
    return null
  }

  try {
    const accessToken = await decompressToken(compressedToken)
    const payload = decodeJwtPayload(accessToken)

    const expiration = payload['exp']

    if (
      typeof expiration !== 'number' ||
      !Number.isSafeInteger(expiration) ||
      Date.now() >= expiration * 1000
    ) {
      return null
    }

    const userInfo = parseUserInfo(payload['UserInfo'])

    if (userInfo === null) {
      return null
    }

    return { accessToken, city, userInfo }
  } catch {
    return null
  }
}

function parseBearerToken(value: string): string | undefined {
  const match = /^Bearer ([^\s]+)$/iu.exec(value)
  return match?.[1]
}

function parseUserInfo(value: unknown): ParsedUserInfo | null {
  let claims: unknown = value

  if (typeof claims === 'string') {
    try {
      claims = JSON.parse(claims)
    } catch {
      return null
    }
  }

  if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) {
    return null
  }

  const personId = 'PersonGid' in claims ? claims.PersonGid : undefined

  if (typeof personId !== 'string' || personId.length === 0) {
    return null
  }

  const firstName = 'FirstName' in claims ? claims.FirstName : undefined
  const lastName = 'SecondName' in claims ? claims.SecondName : undefined

  return {
    PersonGid: personId,
    ...(typeof firstName === 'string' ? { FirstName: firstName } : {}),
    ...(typeof lastName === 'string' ? { SecondName: lastName } : {}),
  }
}
