import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  View,
} from "react-native"
import { useRouter, useSegments } from "expo-router"
import type { Session, User } from "@supabase/supabase-js"
import * as SecureStore from "expo-secure-store"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"

import { supabase } from "@/lib/supabase"

interface Employee {
  id: string
  fullName: string
  alias: string | null
  role: string
  siteId: string | null
  siteName: string | null
  avatarUrl: string | null
  isActive: boolean
}

interface EmployeeSite {
  siteId: string
  siteName: string
  latitude: number | null
  longitude: number | null
  radiusMeters: number | null
  type: string | null
  siteType: string | null
  isPrimary: boolean
}

interface AuthContextType {
  user: User | null
  session: Session | null
  employee: Employee | null
  employeeSites: EmployeeSite[]
  selectedSiteId: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
  setSelectedSite: (siteId: string | null) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const EXPO_PROJECT_ID = "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employeeSites, setEmployeeSites] = useState<EmployeeSite[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [routeBlocking, setRouteBlocking] = useState(true)
  const lastSessionRef = useRef<Session | null>(null)
  const router = useRouter()
  const segments = useSegments() as unknown as string[]
  const bootSplashShownRef = useRef(false)
  // Splash al volver desde background si estuvo inactiva más de X tiempo
  const INACTIVITY_MS = 15 * 60 * 1000 // 15 minutos
  const LOAD_TIMEOUT_MS = 8000

  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const lastBackgroundAtRef = useRef<number | null>(null)
  const pendingResumeSplashRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)
  const pushSyncInFlightRef = useRef(false)

  // Guardamos la ruta actual para poder consultarla dentro del listener de AppState
  const segmentsRef = useRef<string[]>(segments)
  // ✅ Mantener segmentsRef en sync (evita redirects basados en rutas viejas)
  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  const cacheKey = (userId: string, suffix: string) =>
    `auth_cache_${suffix}_${userId}`

  const readCache = async <T,>(key: string): Promise<T | null> => {
    try {
      const stored = await SecureStore.getItemAsync(key)
      if (!stored) return null
      return JSON.parse(stored) as T
    } catch (err) {
      console.warn("[AUTH] Cache read failed:", err)
      return null
    }
  }

  const writeCache = async (key: string, value: unknown) => {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value))
    } catch (err) {
      console.warn("[AUTH] Cache write failed:", err)
    }
  }

  const clearCache = async (userId: string) => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(cacheKey(userId, "employee")),
        SecureStore.deleteItemAsync(cacheKey(userId, "sites")),
        SecureStore.deleteItemAsync(cacheKey(userId, "settings")),
      ])
    } catch (err) {
      console.warn("[AUTH] Cache clear failed:", err)
    }
  }

  const loadEmployee = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(
          `
        id,
        full_name,
        alias,
        role,
        site_id,
        is_active,
        sites:sites!employees_site_id_fkey (name)
      `
        )
        .eq("id", userId)
        .single()

      if (error) {
        console.error("[AUTH] Error loading employee:", error)
        console.error("[AUTH] Error details:", JSON.stringify(error, null, 2))
        return
      }

      if (!data) {
        console.error("[AUTH] No employee data returned for user:", userId)
        setEmployee(null)
        return
      }

      console.log("[AUTH] Employee loaded successfully:", data.id, data.full_name)
      const nextEmployee = {
        id: data.id,
        fullName: data.full_name,
        alias: data.alias,
        role: data.role,
        siteId: data.site_id,
        siteName: (data.sites as any)?.name || null,
        avatarUrl: null,
        isActive: data.is_active,
      }
      setEmployee(nextEmployee)
      await writeCache(cacheKey(userId, "employee"), nextEmployee)
    } catch (err) {
      console.error("[AUTH] Exception loading employee:", err)
    }
  }

  const loadEmployeeSites = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_sites")
        .select(
          `
        site_id,
        is_primary,
        is_active,
        sites:sites!employee_sites_site_id_fkey (
          id,
          name,
          latitude,
          longitude,
          checkin_radius_meters,
          type,
          site_type
        )
      `
        )
        .eq("employee_id", userId)
        .eq("is_active", true)

      if (error) {
        console.error("[AUTH] Error loading employee sites:", error)
        console.error("[AUTH] Error details:", JSON.stringify(error, null, 2))
        return
      }

      if (!data) {
        console.warn("[AUTH] No employee sites data returned for user:", userId)
        setEmployeeSites([])
        return
      }

      const nextSites = data
        .map((row) => {
          const site = row.sites as any
          if (!site) return null
          return {
            siteId: row.site_id,
            siteName: site.name,
            latitude: site.latitude ?? null,
            longitude: site.longitude ?? null,
            radiusMeters: site.checkin_radius_meters ?? null,
            type: site.type ?? null,
            siteType: site.site_type ?? null,
            isPrimary: row.is_primary ?? false,
          } as EmployeeSite
        })
        .filter(Boolean) as EmployeeSite[]

      console.log("[AUTH] Employee sites loaded:", nextSites.length, "sites")
      setEmployeeSites(nextSites)
      await writeCache(cacheKey(userId, "sites"), nextSites)
    } catch (err) {
      console.error("[AUTH] Exception loading employee sites:", err)
    }
  }

  const loadEmployeeSettings = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("employee_settings")
        .select("selected_site_id")
        .eq("employee_id", userId)
        .maybeSingle()

      if (error) {
        console.error("[AUTH] Error loading employee settings:", error)
        return
      }

      const nextSelected = data?.selected_site_id ?? null
      setSelectedSiteId(nextSelected)
      await writeCache(cacheKey(userId, "settings"), {
        selected_site_id: nextSelected,
      })
    } catch (err) {
      console.error("[AUTH] Exception loading employee settings:", err)
    }
  }

  const withTimeout = async <T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T | null> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[AUTH] Timeout while loading ${label}`)
        resolve(null)
      }, ms)

      promise
        .then((value) => {
          if (timeoutId) clearTimeout(timeoutId)
          resolve(value)
        })
        .catch((err) => {
          if (timeoutId) clearTimeout(timeoutId)
          console.error(`[AUTH] Error loading ${label}:`, err)
          resolve(null)
        })
    })
  }

  const hydrateFromCache = async (userId: string) => {
    const [cachedEmployee, cachedSites, cachedSettings] = await Promise.all([
      readCache<Employee>(cacheKey(userId, "employee")),
      readCache<EmployeeSite[]>(cacheKey(userId, "sites")),
      readCache<{ selected_site_id: string | null }>(
        cacheKey(userId, "settings"),
      ),
    ])

    if (cachedEmployee && cachedEmployee.id === userId) {
      setEmployee((prev) => prev ?? cachedEmployee)
    }

    if (cachedSites && cachedSites.length) {
      setEmployeeSites((prev) => (prev.length ? prev : cachedSites))
    }

    if (cachedSettings && cachedSettings.selected_site_id !== undefined) {
      setSelectedSiteId((prev) =>
        prev === null ? cachedSettings.selected_site_id : prev,
      )
    }
  }

  const resetForUser = (userId: string) => {
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      setEmployee(null)
      setEmployeeSites([])
      setSelectedSiteId(null)
    }
    lastUserIdRef.current = userId
  }

  const loadEmployeeBundle = async (userId: string) => {
    resetForUser(userId)
    await hydrateFromCache(userId)
    await Promise.all([
      withTimeout(loadEmployee(userId), LOAD_TIMEOUT_MS, "employee"),
      withTimeout(loadEmployeeSites(userId), LOAD_TIMEOUT_MS, "employee_sites"),
      withTimeout(
        loadEmployeeSettings(userId),
        LOAD_TIMEOUT_MS,
        "employee_settings",
      ),
    ])
  }

  const setSelectedSite = async (siteId: string | null) => {
    if (!user) return
    setSelectedSiteId(siteId)

    const { error } = await supabase.from("employee_settings").upsert(
      {
        employee_id: user.id,
        selected_site_id: siteId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id" }
    )

    if (error) {
      console.error("Error updating selected site:", error)
      return
    }

    await writeCache(cacheKey(user.id, "settings"), {
      selected_site_id: siteId,
    })
  }

  useEffect(() => {
    let isActive = true

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!isActive) return

      setIsLoading(true)

      try {
        if (error) {
          console.warn("[AUTH] getSession error:", error)
          const fallback = lastSessionRef.current
          if (fallback) {
            setSession(fallback)
            setUser(fallback.user ?? null)
          } else {
            setSession(null)
            setUser(null)
            setEmployee(null)
            setEmployeeSites([])
            setSelectedSiteId(null)
          }
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

      if (session?.user) {
        console.log("[AUTH] Loading employee data for user:", session.user.id)
        await loadEmployeeBundle(session.user.id)
        console.log("[AUTH] Employee data loading completed")
      } else {
        setEmployee(null)
        setEmployeeSites([])
        setSelectedSiteId(null)
        lastUserIdRef.current = null
      }
      } finally {
        if (isActive) setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        setIsLoading(true)

        try {
          if (event === "TOKEN_REFRESH_FAILED") {
            console.warn("[AUTH] Token refresh failed, keeping last session")
            const fallback = lastSessionRef.current
            setSession(fallback)
            setUser(fallback?.user ?? null)
            return
          }

          setSession(nextSession)
          setUser(nextSession?.user ?? null)

          if (nextSession?.user) {
            console.log(
              "[AUTH] Auth state changed, loading employee data for user:",
              nextSession.user.id,
            )
            await loadEmployeeBundle(nextSession.user.id)
            console.log(
              "[AUTH] Employee data loading completed after auth state change",
            )
          } else {
            setEmployee(null)
            setEmployeeSites([])
            setSelectedSiteId(null)
            lastUserIdRef.current = null
          }
        } finally {
          setIsLoading(false)
        }
      }
    )

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) lastSessionRef.current = session
  }, [session])

  useEffect(() => {
    const seg0 = segments[0] ?? ""
    const seg1 = segments[1] ?? ""

    const inAuthGroup = seg0 === "(auth)"
    const isSplashRoute = inAuthGroup && seg1 === "splash"

    // Mientras resolvemos sesión, bloquea UI para evitar “flash” de rutas cacheadas
    if (isLoading) {
      if (!routeBlocking) setRouteBlocking(true)
      return
    }

    // 1) En cada arranque del runtime, forzamos pasar por /splash una vez
    if (!bootSplashShownRef.current) {
      bootSplashShownRef.current = true
      if (!isSplashRoute) {
        setRouteBlocking(true)
        router.replace("/splash")
        return
      }
      if (routeBlocking) setRouteBlocking(false)
      return
    }

    // 2) Si no hay usuario y estamos fuera del grupo auth, volvemos a splash
    if (!user && !inAuthGroup) {
      setRouteBlocking(true)
      router.replace("/splash")
      return
    }

    // 3) Si hay usuario y estamos en auth (excepto splash), mandamos a home
    if (user && inAuthGroup && !isSplashRoute) {
      setRouteBlocking(true)
      router.replace("/home")
      return
    }

    // Si estamos en splash o ya estamos en la ruta correcta, desbloquear
    if (routeBlocking) setRouteBlocking(false)
  }, [user, isLoading, segments, router, routeBlocking])

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState

      // Cuando se va a background/inactive, marcamos timestamp
      if (prevState === "active" && (nextState === "background" || nextState === "inactive")) {
        lastBackgroundAtRef.current = Date.now()
        return
      }

      // Cuando vuelve a active, evaluamos inactividad
      if ((prevState === "background" || prevState === "inactive") && nextState === "active") {
        const last = lastBackgroundAtRef.current
        lastBackgroundAtRef.current = null

        if (!last) return

        const inactiveFor = Date.now() - last
        if (inactiveFor < INACTIVITY_MS) return

        // Si todavía está cargando auth, lo dejamos pendiente
        if (isLoading) {
          pendingResumeSplashRef.current = true
          return
        }

        const seg0 = segmentsRef.current?.[0] ?? ""
        const seg1 = segmentsRef.current?.[1] ?? ""
        const inAuthGroup = seg0 === "(auth)"
        const isSplashRoute = inAuthGroup && seg1 === "splash"

        if (!isSplashRoute) {
          router.replace("/splash")
        }
      }
    })

    return () => {
      sub.remove()
    }
  }, [router, isLoading])

  useEffect(() => {
    if (!routeBlocking || isLoading) return
    const timer = setTimeout(() => {
      setRouteBlocking(false)
    }, 12000)
    return () => clearTimeout(timer)
  }, [routeBlocking, isLoading])
  useEffect(() => {
    if (isLoading) return
    if (!pendingResumeSplashRef.current) return

    pendingResumeSplashRef.current = false

    const seg0 = segmentsRef.current?.[0] ?? ""
    const seg1 = segmentsRef.current?.[1] ?? ""
    const inAuthGroup = seg0 === "(auth)"
    const isSplashRoute = inAuthGroup && seg1 === "splash"

    if (!isSplashRoute) {
      router.replace("/splash")
    }
  }, [isLoading, router])

  useEffect(() => {
    const syncPushToken = async () => {
      if (!user?.id) return
      if (!Device.isDevice) return
      if (pushSyncInFlightRef.current) return

      pushSyncInFlightRef.current = true
      try {
        const permissions = await Notifications.getPermissionsAsync()
        if (permissions.status !== "granted") return

        const tokenResult = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID,
        })
        const token = tokenResult.data
        if (!token) return

        await supabase.functions.invoke("register-push-token", {
          body: {
            token,
            platform: Platform.OS,
          },
        })
      } catch (err) {
        console.warn("[AUTH] Push token sync skipped:", err)
      } finally {
        pushSyncInFlightRef.current = false
      }
    }

    void syncPushToken()
  }, [user?.id])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    const userId = user?.id ?? null
    await supabase.auth.signOut()
    setEmployee(null)
    setEmployeeSites([])
    setSelectedSiteId(null)
    lastUserIdRef.current = null
    if (userId) {
      await clearCache(userId)
    }
  }

  const refreshEmployee = async () => {
    if (user) {
      await loadEmployeeBundle(user.id)
    }
  }

  const isSplashSegment = segments.includes("splash")

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        employee,
        employeeSites,
        selectedSiteId,
        isLoading,
        signIn,
        signOut,
        refreshEmployee,
        setSelectedSite,
      }}
    >
      {children}

      {routeBlocking && !isSplashSegment ? (
        <View style={styles.routeBlocker} pointerEvents="auto">
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de AuthProvider")
  }
  return context
}
const styles = StyleSheet.create({
  routeBlocker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
})
