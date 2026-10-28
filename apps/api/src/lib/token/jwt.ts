import { TokenIssuanceError } from '@/shared/errors/auth.errors'

export const decodeJwtPayload = (token: string): Record<string, unknown> => {
  try {
    const parts = token.split('.')
    const payload = parts[1]

    if (parts.length !== 3 || payload === undefined || payload.length === 0) {
      throw new Error('Invalid JWT structure.')
    }

    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const decoded = atob(padded)
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('JWT payload must be an object.')
    }

    return value as Record<string, unknown>
  } catch (cause) {
    throw new TokenIssuanceError('The NIS service returned an invalid token.', { cause })
  }
}

export const decodeJwtExpiration = (token: string): number => {
  try {
    const payload = decodeJwtPayload(token)
    const expiration = payload['exp']

    if (expiration === undefined) {
      throw new Error('JWT expiration is missing.')
    }

    if (typeof expiration !== 'number' || !Number.isSafeInteger(expiration)) {
      throw new Error('JWT expiration is invalid.')
    }

    return expiration
  } catch (cause) {
    throw new TokenIssuanceError('The NIS service returned an invalid token.', { cause })
  }
}
