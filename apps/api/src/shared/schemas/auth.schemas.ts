import { DEFAULT_DEVICE } from '../config/constants'
import { z } from 'zod'

export interface LoginInput {
  readonly iin: string
  readonly password: string
}

export const LoginInputSchema = z
  .object({
    iin: z.string().regex(/^\d{12}$/u),
    password: z.string().min(1).max(256),
  })
  .strict()

export interface AuthenticateRequest {
  readonly action: 'v1/Users/Authenticate'
  readonly operationId: string
  readonly username: string
  readonly password: string
  readonly deviceInfo: typeof DEFAULT_DEVICE
}

export interface ReissueTokensRequest {
  readonly action: 'v1/Users/ReissueTokens'
  readonly operationId: string
  readonly refreshToken: string
  readonly deviceInfo: string
}

export interface Application {
  readonly organizationGid?: string
  readonly type?: number
  readonly url?: string
}

export interface LoginHttpResponse {
  readonly accessToken: string
  readonly refreshToken: string
  readonly applications?: readonly Application[]
}

export interface AdditionalUserInfoResponse {
  readonly success?: boolean
  readonly data?: {
    readonly PhotoUrl?: string | null
    readonly Klass?: string | null
    readonly School?: {
      readonly Gid?: string
      readonly Name?: LocalizedText
    }
  }
  readonly message?: string
  readonly StatusCode?: number
}

export interface LocalizedText {
  readonly kk?: string
  readonly ru?: string
  readonly en?: string
}

export interface UserInfoClaims {
  readonly PersonGid?: string
  readonly FirstName?: string
  readonly SecondName?: string
}

export interface JournalSubject {
  readonly id: string
  readonly name: LocalizedText
  readonly currScore: number
  // Upstream sends an empty string when the subject is not graded yet,
  // rather than omitting the field.
  readonly mark?: number | string | null
}

export interface JournalPeriod {
  readonly number: 1 | 2 | 3 | 4
  readonly isActual?: boolean
  readonly subjects: readonly JournalSubject[]
}

export type Journal = [
  JournalPeriod & { readonly number: 1 },
  JournalPeriod & { readonly number: 2 },
  JournalPeriod & { readonly number: 3 },
  JournalPeriod & { readonly number: 4 },
]

export interface RubricDetail {
  readonly name: string
  readonly bad: string
  readonly normal: string
  readonly good: string
  readonly badChecked: boolean
  readonly normalChecked: boolean
  readonly goodChecked: boolean
}

export interface Rubric {
  readonly id: string
  readonly title: LocalizedText
  readonly mark: string
  readonly maxMark: string
  readonly description: LocalizedText
  readonly details: readonly RubricDetail[]
}

export interface RubricInfo {
  readonly sumChapterCriteria: readonly Rubric[]
  readonly sumQuarterCriteria: readonly Rubric[]
}

export interface ReportPeriodMark extends LocalizedText {}

export interface ReportCardSubject {
  readonly id: string
  readonly name: LocalizedText
}

export interface ReportCardRow {
  readonly person: { readonly id: string }
  readonly subject: ReportCardSubject
  readonly firstPeriod?: ReportPeriodMark | null
  readonly secondPeriod?: ReportPeriodMark | null
  readonly thirdPeriod?: ReportPeriodMark | null
  readonly fourthPeriod?: ReportPeriodMark | null
  readonly firstHalfYearMark?: ReportPeriodMark | null
  readonly secondHalfYearMark?: ReportPeriodMark | null
  readonly yearMark?: ReportPeriodMark | null
  readonly examMark?: ReportPeriodMark | null
  readonly resultMark?: ReportPeriodMark | null
}

export interface ReportCard {
  readonly schoolYear: {
    readonly isCurrent: boolean
    readonly id: string
    readonly name: LocalizedText
  }
  readonly reportCard: readonly ReportCardRow[]
}

export type Reports = readonly ReportCard[]

export type AdditionalUserInfo = AdditionalUserInfoResponse

export interface UserInfoRequest {
  readonly applicationType: 'ContingentAPI'
  readonly action: 'Api/AdditionalUserInfo'
  readonly operationId: string
}
