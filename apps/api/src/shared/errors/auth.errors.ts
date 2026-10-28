export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid IIN or password.') {
    super(message)
    this.name = 'InvalidCredentialsError'
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor(message = 'The refresh token is invalid or expired.') {
    super(message)
    this.name = 'InvalidRefreshTokenError'
  }
}

export class UserNotEnrolledError extends Error {
  constructor(
    message = 'Account found, but you are not enrolled in any NIS branch. You may be using a parent account.',
  ) {
    super(message)
    this.name = 'UserNotEnrolledError'
  }
}

export class NisHttpError extends Error {
  constructor(message = 'The NIS service request failed.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'NisHttpError'
  }
}

export class CityUrlParseError extends Error {
  readonly rawUrl: string

  constructor(rawUrl: string) {
    super(`Failed to parse city code from URL: ${rawUrl}`)
    this.name = 'CityUrlParseError'
    this.rawUrl = rawUrl
  }
}

export class TokenIssuanceError extends Error {
  constructor(message = 'Token issuance failed.', options?: ErrorOptions) {
    super(message, options)
    this.name = 'TokenIssuanceError'
  }
}
