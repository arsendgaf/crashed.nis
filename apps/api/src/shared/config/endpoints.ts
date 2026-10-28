export const NIS_ENDPOINTS = {
  identity: 'https://identity.micros.nis.edu.kz/v1/Users/Authenticate',
  identityRefresh: 'https://identity.micros.nis.edu.kz/v1/Users/ReissueTokens',
  contingent: 'https://contingent.micros.nis.edu.kz/Api/AdditionalUserInfo',
  reportCard: 'https://reportcard.micros.nis.edu.kz/v1/ReportCard/GetAllReportCardsAsync',
  jce: (city: string, method: string) => `https://sms.${city}.nis.edu.kz/jce/Api/${method}`,
} as const
