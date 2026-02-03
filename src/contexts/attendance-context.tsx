import type { ReactNode } from "react"
import { createContext, useContext } from "react"

import { useAttendance } from "@/hooks/use-attendance"

type AttendanceContextValue = ReturnType<typeof useAttendance>

const AttendanceContext = createContext<AttendanceContextValue | null>(null)

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const value = useAttendance()
  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
}

export function useAttendanceContext() {
  const context = useContext(AttendanceContext)
  if (!context) {
    throw new Error("useAttendanceContext debe ser usado dentro de AttendanceProvider")
  }
  return context
}
