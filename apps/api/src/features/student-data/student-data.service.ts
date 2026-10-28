import type { KyInstance } from 'ky'
import { NIS_ENDPOINTS } from '@/shared/config/endpoints'
import type { Journal, Reports } from '@/shared/schemas/auth.schemas'

export const getJournal = (
  client: KyInstance,
  accessToken: string,
  studentId: string,
  city: string,
): Promise<Journal> =>
  client
    .post(NIS_ENDPOINTS.jce(city, 'Api/GetSubjectsAndPeriods'), {
      headers: { Authorization: `Bearer ${accessToken}` },
      json: {
        action: 'Api/GetSubjectsAndPeriods',
        operationId: crypto.randomUUID(),
        studentId,
      },
    })
    .json<Journal>()

export const getJournalRubric = (
  client: KyInstance,
  accessToken: string,
  studentId: string,
  city: string,
  subjectId: string,
  quarter: number,
): Promise<Response> =>
  client.post(NIS_ENDPOINTS.jce(city, 'Api/GetDataBySectionAndByPeriod'), {
    headers: { Authorization: `Bearer ${accessToken}` },
    throwHttpErrors: false,
    json: {
      action: 'Api/GetDataBySectionAndByPeriod',
      operationId: crypto.randomUUID(),
      studentId,
      subjectId,
      periodIndex: quarter,
    },
  })

export const getReports = (
  client: KyInstance,
  accessToken: string,
  studentId: string,
): Promise<Reports> =>
  client
    .post(NIS_ENDPOINTS.reportCard, {
      headers: { Authorization: `Bearer ${accessToken}` },
      json: {
        action: 'v1/ReportCard/GetAllReportCardsAsync',
        operationId: crypto.randomUUID(),
        studentId,
      },
    })
    .json<Reports>()
