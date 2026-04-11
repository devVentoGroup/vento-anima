export type ReportEmployeeOption = {
  id: string
  label: string
  role: string | null
  siteIds: string[]
}

export type ReportSiteOption = {
  id: string
  label: string
}

export type ReportSummarySnapshot = {
  scheduledShifts: number
  attendedShifts: number
  lateCount: number
  noShowCount: number
  openCount: number
  missingCloseCount: number
  autoCloseCount: number
  departureCount: number
  scheduledMinutes: number
  netMinutes: number
  attendanceRate: number
  punctualityRate: number
}

export type ReportEmployeeSummary = {
  employeeName: string
  incidentCount: number
  lateCount: number
  noShowCount: number
  openCount: number
}

export type ReportSiteSummary = {
  siteName: string
  incidentCount: number
  lateCount: number
  noShowCount: number
  openCount: number
}

export type ReportIncidentSummary = {
  category: string
  employeeName: string
  detail: string
}

export type ReportSummaryResponse = {
  summary: ReportSummarySnapshot
  topEmployees: ReportEmployeeSummary[]
  topSites: ReportSiteSummary[]
  incidents: ReportIncidentSummary[]
  incidentCountTotal: number
}
