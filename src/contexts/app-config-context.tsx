import type { ReactNode } from "react"
import { createContext, useContext } from "react"
import { useAppConfig, type AppConfigState } from "@/hooks/use-app-config"

type AppConfigContextValue = AppConfigState & {
  loaded: boolean
  refresh: () => Promise<void>
}

const defaults: AppConfigContextValue = {
  locale: "es-CO",
  timezone: "America/Bogota",
  featureFlags: {},
  getText: () => null,
  loaded: false,
  refresh: async () => {},
}

const AppConfigContext = createContext<AppConfigContextValue>(defaults)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const config = useAppConfig()
  return (
    <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
  )
}

export function useAppConfigContext(): AppConfigContextValue {
  return useContext(AppConfigContext)
}
