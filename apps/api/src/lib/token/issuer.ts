import type { CookieOptions } from 'hono/utils/cookie'
import { DEFAULT_DEVICE } from '@/shared/config/constants'
import { TokenIssuanceError } from '@/shared/errors/auth.errors'
import type { LoginHttpResponse } from '@/shared/schemas/auth.schemas'
import { compressToken } from './compressor'
import { decodeJwtExpiration } from './jwt'

export interface IssuedTokenCookies {
  readonly access: {
    readonly value: string
    readonly options: CookieOptions
  }
  readonly refresh: {
    readonly value: string
    readonly options: CookieOptions
  }
}

export const issueTokenCookies = async (
  tokens: Pick<LoginHttpResponse, 'accessToken' | 'refreshToken'>,
  city: string,
): Promise<IssuedTokenCookies> => {
  const now = Math.floor(Date.now() / 1000)
  const accessExpiration = decodeJwtExpiration(tokens.accessToken)
  const refreshExpiration = decodeJwtExpiration(tokens.refreshToken)

  if (accessExpiration <= now || refreshExpiration <= now) {
    throw new TokenIssuanceError('The NIS service returned an expired token.')
  }

  const [accessToken, refreshToken] = await Promise.all([
    compressToken(tokens.accessToken),
    compressToken(tokens.refreshToken),
  ])
  const commonOptions: CookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: true,
  }

  return {
    access: {
      value: `${accessToken}::${city}`,
      options: {
        ...commonOptions,
        maxAge: Math.min(60 * 60, accessExpiration - now),
      },
    },
    refresh: {
      value: `${refreshToken}::${DEFAULT_DEVICE}`,
      options: {
        ...commonOptions,
        maxAge: Math.min(30 * 24 * 60 * 60, refreshExpiration - now),
      },
    },
  }
}
