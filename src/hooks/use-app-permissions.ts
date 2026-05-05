import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type PermissionState = Record<string, boolean>

export function useAppPermissions(permissionCodes: string[]) {
  const permissionKey = permissionCodes.join("|")
  const stableCodes = useMemo(
    () => Array.from(new Set(permissionCodes.map((code) => code.trim()).filter(Boolean))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionKey],
  )
  const [permissions, setPermissions] = useState<PermissionState>({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (stableCodes.length === 0) {
      setPermissions({})
      setLoaded(true)
      return
    }

    setLoaded(false)
    try {
      const results = await Promise.all(
        stableCodes.map(async (code) => {
          const { data, error } = await supabase.rpc("has_permission", {
            p_permission_code: code,
          })
          return [code, !error && Boolean(data)] as const
        }),
      )
      setPermissions(Object.fromEntries(results))
    } catch (error) {
      console.warn("[APP_PERMISSIONS] Error loading permissions:", error)
      setPermissions({})
    } finally {
      setLoaded(true)
    }
  }, [stableCodes])

  useEffect(() => {
    void load()
  }, [load])

  const has = useCallback(
    (permissionCode: string) => Boolean(permissions[permissionCode]),
    [permissions],
  )

  return { permissions, loaded, has, refresh: load }
}
