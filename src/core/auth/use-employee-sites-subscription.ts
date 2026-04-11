import { useEffect } from "react"

import { supabase } from "@/lib/supabase"

type EmployeeSitesSubscriptionArgs = {
  userId: string | null | undefined
  onPendingChange: () => void
}

export function useEmployeeSitesSubscription({
  userId,
  onPendingChange,
}: EmployeeSitesSubscriptionArgs) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`employee-sites-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_sites",
          filter: `employee_id=eq.${userId}`,
        },
        () => {
          onPendingChange()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, onPendingChange])
}
