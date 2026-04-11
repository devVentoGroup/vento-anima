import { useEffect } from "react"
import type { User } from "@supabase/supabase-js"

import { setMonitoringUser } from "@/lib/monitoring"

export function useMonitoringUserSync(user: User | null) {
  useEffect(() => {
    setMonitoringUser(
      user
        ? {
            id: user.id,
            email: user.email ?? null,
          }
        : null,
    )
  }, [user])
}
