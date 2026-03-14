import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type AppConfigState = {
  locale: string
  timezone: string
  featureFlags: Record<string, boolean>
  getText: (key: string) => string | null
}

const DEFAULT_LOCALE = "es-CO"
const DEFAULT_TIMEZONE = "America/Bogota"

function parseJsonValue(val: unknown): string | Record<string, unknown> | null {
  if (val == null) return null
  if (typeof val === "string") return val
  if (typeof val === "object" && val !== null) return val as Record<string, unknown>
  return null
}

function stringFromJson(val: unknown): string {
  const p = parseJsonValue(val)
  if (typeof p === "string") return p
  if (p && typeof p === "object" && "value" in p && typeof (p as any).value === "string")
    return (p as any).value
  return ""
}

export function useAppConfig() {
  const [state, setState] = useState<AppConfigState>({
    locale: DEFAULT_LOCALE,
    timezone: DEFAULT_TIMEZONE,
    featureFlags: {},
    getText: () => null,
  })
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("key, value")

      if (error) throw error

      const keyValue = new Map<string, unknown>()
      for (const row of data ?? []) {
        const k = (row as { key: string }).key
        const v = (row as { value: unknown }).value
        if (k) keyValue.set(k, v)
      }

      const locale = stringFromJson(keyValue.get("locale")) || DEFAULT_LOCALE
      const timezone = stringFromJson(keyValue.get("timezone")) || DEFAULT_TIMEZONE
      const ffRaw = keyValue.get("feature_flags")
      let featureFlags: Record<string, boolean> = {}
      if (ffRaw && typeof ffRaw === "object" && ffRaw !== null) {
        const o = ffRaw as Record<string, unknown>
        for (const k of Object.keys(o)) {
          featureFlags[k] = Boolean(o[k])
        }
      }

      const getText = (key: string): string | null => {
        const textKey = key.startsWith("text.") ? key : `text.${key}`
        const v = keyValue.get(textKey)
        const s = stringFromJson(v)
        return s || null
      }

      setState({ locale, timezone, featureFlags, getText })
    } catch (e) {
      console.warn("[APP_CONFIG] Error loading config, using defaults:", e)
      setState({
        locale: DEFAULT_LOCALE,
        timezone: DEFAULT_TIMEZONE,
        featureFlags: {},
        getText: () => null,
      })
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, loaded, refresh: load }
}
