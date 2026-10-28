import type { KyInstance } from 'ky'
import { NIS_ENDPOINTS } from '@/shared/config/endpoints'
import type { AdditionalUserInfoResponse, UserInfoRequest } from '@/shared/schemas/auth.schemas'

export const getAdditionalUserInfo = async (
  client: KyInstance,
  accessToken: string,
): Promise<AdditionalUserInfoResponse> => {
  const request: UserInfoRequest = {
    applicationType: 'ContingentAPI',
    action: 'Api/AdditionalUserInfo',
    operationId: crypto.randomUUID(),
  }
  return client
    .post(NIS_ENDPOINTS.contingent, {
      headers: { Authorization: `Bearer ${accessToken}` },
      json: request,
    })
    .json<AdditionalUserInfoResponse>()
}
