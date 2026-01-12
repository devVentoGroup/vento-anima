import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { useRouter, useSegments } from "expo-router"
import type { Session, User } from "@supabase/supabase-js"
import { ActivityIndicator, StyleSheet, View } from "react-native"

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

interface AuthContextType {
  user: User | null
  session: Session | null
  employee: Employee | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [routeBlocking, setRouteBlocking] = useState(true)
  const router = useRouter()
  const segments = useSegments() as unknown as string[]
  const bootSplashShownRef = useRef(false)
  // Splash al volver desde background si estuvo inactiva más de X tiempo
  const INACTIVITY_MS = 15 * 60 * 1000 // 15 minutos

  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const lastBackgroundAtRef = useRef<number | null>(null)
  const pendingResumeSplashRef = useRef(false)

  // Guardamos la ruta actual para poder consultarla dentro del listener de AppState
  const segmentsRef = useRef<string[]>(segments)
  // ✅ Mantener segmentsRef en sync (evita redirects basados en rutas viejas)
  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  const loadEmployee = async (userId: string) => {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        id,
        full_name,
        alias,
        role,
        site_id,
        avatar_url,
        is_active,
        sites (name)
      `
      )
      .eq("id", userId)
      .single()

    if (error || !data) {
      console.error("Error loading employee:", error)
      setEmployee(null)
      return
    }

    setEmployee({
      id: data.id,
      fullName: data.full_name,
      alias: data.alias,
      role: data.role,
      siteId: data.site_id,
      siteName: (data.sites as any)?.name || null,
      avatarUrl: data.avatar_url,
      isActive: data.is_active,
    })
  }

  useEffect(() => {
    let isActive = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isActive) return

      setIsLoading(true)
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        await loadEmployee(session.user.id)
      } else {
        setEmployee(null)
      }

      if (!isActive) return
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setIsLoading(true)

        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        if (nextSession?.user) {
          await loadEmployee(nextSession.user.id)
        } else {
          setEmployee(null)
        }

        setIsLoading(false)
      }
    )

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

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
      setRouteBlocking(true)
      router.replace("/(auth)/splash")
      return
    }

    // 2) Si no hay usuario y estamos fuera del grupo auth, volvemos a splash
    if (!user && !inAuthGroup) {
      setRouteBlocking(true)
      router.replace("/(auth)/splash")
      return
    }

    // 3) Si hay usuario y estamos en auth (excepto splash), mandamos a home
    if (user && inAuthGroup && !isSplashRoute) {
      setRouteBlocking(true)
      router.replace("/(app)/home")
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
          router.replace("/(auth)/splash")
        }
      }
    })

    return () => {
      sub.remove()
    }
  }, [router, isLoading])
  useEffect(() => {
    if (isLoading) return
    if (!pendingResumeSplashRef.current) return

    pendingResumeSplashRef.current = false

    const seg0 = segmentsRef.current?.[0] ?? ""
    const seg1 = segmentsRef.current?.[1] ?? ""
    const inAuthGroup = seg0 === "(auth)"
    const isSplashRoute = inAuthGroup && seg1 === "splash"

    if (!isSplashRoute) {
      router.replace("/(auth)/splash")
    }
  }, [isLoading, router])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Sign-in error:", error)
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setEmployee(null)
  }

  const refreshEmployee = async () => {
    if (user) {
      await loadEmployee(user.id)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        employee,
        isLoading,
        signIn,
        signOut,
        refreshEmployee,
      }}
    >
      {children}

      {routeBlocking ? (
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
