import { CityUrlParseError } from '@/shared/errors/auth.errors'

export const parseCityFromJceUrl = (value: string): string => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new CityUrlParseError(value)
  }

  const labels = url.hostname.toLowerCase().split('.')
  const city = labels[1]
  const firstPathSegment = url.pathname.toLowerCase().split('/').filter(Boolean)[0]

  if (
    url.protocol !== 'https:' ||
    firstPathSegment !== 'jce' ||
    labels.length !== 5 ||
    labels[0] !== 'sms' ||
    labels[2] !== 'nis' ||
    labels[3] !== 'edu' ||
    labels[4] !== 'kz' ||
    city === undefined ||
    !/^[a-z0-9-]+$/u.test(city)
  ) {
    throw new CityUrlParseError(value)
  }

  return city
}
