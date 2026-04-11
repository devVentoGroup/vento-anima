import type { Session, User } from "@supabase/supabase-js"

export interface Employee {
  id: string
  fullName: string
  alias: string | null
  role: string
  siteId: string | null
  siteName: string | null
  avatarUrl: string | null
  isActive: boolean
}

export interface EmployeeSite {
  siteId: string
  siteName: string
  latitude: number | null
  longitude: number | null
  radiusMeters: number | null
  type: string | null
  siteType: string | null
  isPrimary: boolean
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  employee: Employee | null
  employeeSites: EmployeeSite[]
  selectedSiteId: string | null
  hasPendingSiteChanges: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
  consumePendingSiteChanges: () => void
  setSelectedSite: (siteId: string | null) => Promise<void>
}
