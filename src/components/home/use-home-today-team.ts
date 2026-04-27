import { useCallback, useEffect, useRef, useState } from "react"

import { supabase } from "@/lib/supabase"

type TeamMemberShift = {
  id: string
  employee_id: string
  start_time: string
  end_time: string
  show_end_as_close?: boolean | null
  employees?: { full_name: string | null } | { full_name: string | null }[]
}

function getTodayIsoDate() {
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return now.toISOString().slice(0, 10)
}

function getEmployeeName(entry: TeamMemberShift) {
  const employee = entry.employees
  if (!employee) return "Compañero"
  const fullName = Array.isArray(employee) ? employee[0]?.full_name : employee.full_name
  return fullName ?? "Compañero"
}

export function useHomeTodayTeam({
  userId,
  siteId,
  enabled,
}: {
  userId: string | undefined
  siteId: string | null | undefined
  enabled: boolean
}) {
  const CACHE_MS = 15000
  const [rows, setRows] = useState<TeamMemberShift[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const lastLoadedAtRef = useRef(0)

  const loadTodayTeam = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled || !siteId) {
        setRows([])
        return
      }
      if (inFlightRef.current) {
        await inFlightRef.current
        return
      }
      if (!opts?.force && Date.now() - lastLoadedAtRef.current < CACHE_MS) return

      const task = (async () => {
        setIsLoading(true)
        try {
          const { data, error } = await supabase
            .from("employee_shifts")
            .select(
              "id, employee_id, start_time, end_time, show_end_as_close, employees!employee_shifts_employee_id_fkey(full_name)",
            )
            .eq("site_id", siteId)
            .eq("shift_date", getTodayIsoDate())
            .not("published_at", "is", null)
            .in("status", ["scheduled", "confirmed"])
            .order("start_time", { ascending: true })

          if (error) throw error
          setRows(((data ?? []) as TeamMemberShift[]).slice())
          lastLoadedAtRef.current = Date.now()
        } catch (error) {
          console.error("[HOME] Error loading today team:", error)
          setRows([])
        } finally {
          setIsLoading(false)
        }
      })()

      inFlightRef.current = task
      try {
        await task
      } finally {
        inFlightRef.current = null
      }
    },
    [enabled, siteId],
  )

  useEffect(() => {
    void loadTodayTeam()
  }, [loadTodayTeam])

  const teamRows = rows
  const coworkerRows = rows.filter((row) => row.employee_id !== userId)
  const coworkerNames = coworkerRows.map(getEmployeeName)

  return {
    isLoading,
    teamCount: teamRows.length,
    coworkerCount: coworkerRows.length,
    coworkerNames,
    refreshTodayTeam: () => loadTodayTeam({ force: true }),
  }
}
