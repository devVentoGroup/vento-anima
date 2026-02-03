import { useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"

import SplashScreen from "@/components/SplashScreen"
import { useAuth } from "@/contexts/auth-context"
import { useAttendanceContext } from "@/contexts/attendance-context"

export default function AuthSplashScreen() {
  const router = useRouter()
  const { user, employee, isLoading } = useAuth()
  const { loadTodayAttendance, refreshGeofence } = useAttendanceContext()
  const userRef = useRef(user)
  const [fallbackReady, setFallbackReady] = useState(false)
  const [bootReady, setBootReady] = useState(false)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    setBootReady(false)
  }, [user?.id])

  useEffect(() => {
    const timer = setTimeout(() => setFallbackReady(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (isLoading) {
      setBootReady(false)
      return () => {
        cancelled = true
      }
    }

    if (!user) {
      setBootReady(true)
      return () => {
        cancelled = true
      }
    }

    const runBootstrap = async () => {
      try {
        await loadTodayAttendance()

        if (employee) {
          await refreshGeofence({ force: true, mode: "check_in" })
        }
      } catch (error) {
        console.warn("[SPLASH] Bootstrap error:", error)
      } finally {
        if (!cancelled) setBootReady(true)
      }
    }

    void runBootstrap()

    return () => {
      cancelled = true
    }
  }, [isLoading, user, employee, loadTodayAttendance, refreshGeofence])

  const isAppReady = (!isLoading && bootReady) || fallbackReady

  return (
    <SplashScreen
      isAppReady={isAppReady}
      onFinish={() => router.replace(userRef.current ? "/home" : "/login")}
    />
  )
}
