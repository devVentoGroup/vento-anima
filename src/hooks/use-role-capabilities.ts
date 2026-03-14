import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useRoleCapabilities(role: string | null) {
  const [capabilities, setCapabilities] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!role || !role.trim()) {
      setCapabilities(new Set())
      setLoaded(true)
      return
    }
    try {
      const { data, error } = await supabase
        .from("role_capabilities")
        .select("capability")
        .eq("role", role.trim().toLowerCase())

      if (error) throw error
      const capSet = new Set<string>(
        (data ?? []).map((row: { capability: string }) => String(row.capability).trim()).filter(Boolean)
      )
      setCapabilities(capSet)
    } catch (e) {
      console.warn("[ROLE_CAPABILITIES] Error loading capabilities, using empty set:", e)
      setCapabilities(new Set())
    } finally {
      setLoaded(true)
    }
  }, [role])

  useEffect(() => {
    load()
  }, [load])

  const has = useCallback(
    (capability: string) => capabilities.has(capability),
    [capabilities]
  )

  return { capabilities, loaded, has, refresh: load }
}
