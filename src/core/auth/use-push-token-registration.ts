import { useEffect, useRef } from "react"
import { Platform } from "react-native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { supabase } from "@/lib/supabase"

type PushTokenRegistrationArgs = {
  userId: string | null | undefined
  expoProjectId: string
}

export function usePushTokenRegistration({
  userId,
  expoProjectId,
}: PushTokenRegistrationArgs) {
  const pushSyncInFlightRef = useRef(false)

  useEffect(() => {
    const syncPushToken = async () => {
      if (!userId) return
      if (!Device.isDevice) return
      if (pushSyncInFlightRef.current) return

      pushSyncInFlightRef.current = true
      try {
        const permissions = await Notifications.getPermissionsAsync()
        if (permissions.status !== "granted") return

        const tokenResult = await Notifications.getExpoPushTokenAsync({
          projectId: expoProjectId,
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
  }, [userId, expoProjectId])
}
