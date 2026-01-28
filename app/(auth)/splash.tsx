import { useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"

import SplashScreen from "@/components/SplashScreen"
import { useAuth } from "@/contexts/auth-context"

export default function AuthSplashScreen() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const userRef = useRef(user)
  const [fallbackReady, setFallbackReady] = useState(false)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    const timer = setTimeout(() => setFallbackReady(true), 6000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <SplashScreen
      isAppReady={!isLoading || fallbackReady}
      onFinish={() => router.replace(userRef.current ? "/home" : "/login")}
    />
  )
}
