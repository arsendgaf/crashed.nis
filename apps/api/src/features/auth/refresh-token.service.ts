import type { KyInstance } from 'ky'
import { getAdditionalUserInfo } from '@/features/user-info/user-info.service'
import { parseCityFromJceUrl } from '@/lib/utils/city'
import { JCE_APP_TYPE } from '@/shared/config/constants'
import { NIS_ENDPOINTS } from '@/shared/config/endpoints'
import { TokenIssuanceError, UserNotEnrolledError } from '@/shared/errors/auth.errors'
import type { LoginHttpResponse, ReissueTokensRequest } from '@/shared/schemas/auth.schemas'

export interface RefreshedSession {
  readonly tokens: Pick<LoginHttpResponse, 'accessToken' | 'refreshToken'>
  readonly city: string
}

export const refreshNisSession = async (
  client: KyInstance,
  refreshToken: string,
  deviceInfo: string,
): Promise<RefreshedSession> => {
  const request: ReissueTokensRequest = {
    action: 'v1/Users/ReissueTokens',
    operationId: crypto.randomUUID(),
    refreshToken,
    deviceInfo,
  }
  const response = await client
    .post(NIS_ENDPOINTS.identityRefresh, { json: request, retry: 0 })
    .json<LoginHttpResponse>()

  if (typeof response.accessToken !== 'string' || typeof response.refreshToken !== 'string') {
    throw new TokenIssuanceError('The NIS service returned invalid refreshed tokens.')
  }

  const userInfo = await getAdditionalUserInfo(client, response.accessToken)
  const schoolId = userInfo?.data?.School?.Gid
  const application = response.applications?.find(
    (candidate) => candidate?.organizationGid === schoolId && candidate?.type === JCE_APP_TYPE,
  )

  if (application?.url === undefined) {
    throw new UserNotEnrolledError()
  }

  return {
    tokens: response,
    city: parseCityFromJceUrl(application.url),
  }
}
