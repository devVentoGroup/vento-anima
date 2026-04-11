import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, Linking, Platform } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { supabase } from "@/lib/supabase"

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unknown"

type UseHomeNotificationsArgs = {
  userId: string | null | undefined
  authIsLoading: boolean
  initialLoadDone: boolean
  dependencyKey: string
  expoProjectId: string
}

function mapPermissionStatus(status: Notifications.PermissionStatus): NotificationPermissionStatus {
  if (status === "granted") return "granted"
  if (status === "denied") return "denied"
  if (status === "undetermined") return "undetermined"
  return "unknown"
}

export function useHomeNotifications({
  userId,
  authIsLoading,
  initialLoadDone,
  dependencyKey,
  expoProjectId,
}: UseHomeNotificationsArgs) {
  const notificationsPromptAttemptedForUserRef = useRef<string | null>(null)
  const notificationsPromptInFlightRef = useRef(false)
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermissionStatus>("unknown")
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false)

  const syncPushToken = useCallback(async () => {
    if (!userId || !Device.isDevice) return
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId: expoProjectId,
      })
      const token = tokenResult.data
      if (!token) return

      const { error } = await supabase.functions.invoke("register-push-token", {
        body: {
          token,
          platform: Platform.OS,
        },
      })
      if (error) {
        console.warn("[HOME] register-push-token error:", error)
      }
    } catch (err) {
      console.warn("[HOME] Push token sync failed:", err)
    }
  }, [userId, expoProjectId])

  const refreshNotificationPermission = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync()
      setNotificationPermissionStatus(mapPermissionStatus(perm.status))
    } catch {
      setNotificationPermissionStatus("unknown")
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void refreshNotificationPermission()
    }, [refreshNotificationPermission]),
  )

  const requestNotificationPermissionOrOpenSettings = useCallback(async () => {
    setNotificationPromptLoading(true)
    try {
      const current = await Notifications.getPermissionsAsync()
      const status = mapPermissionStatus(current.status)
      const canAsk = typeof current.canAskAgain === "boolean" ? current.canAskAgain : null

      if (status === "granted") {
        await syncPushToken()
        await refreshNotificationPermission()
        return
      }

      if (status === "denied" && canAsk === false) {
        Alert.alert(
          "Notificaciones desactivadas",
          "Para recibir avisos de ANIMA activa las notificaciones en Ajustes del dispositivo.",
          [
            { text: "Cerrar", style: "cancel" },
            { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
          ],
        )
        await refreshNotificationPermission()
        return
      }

      const { status: asked } = await Notifications.requestPermissionsAsync()
      await refreshNotificationPermission()
      if (asked === "granted") {
        await syncPushToken()
        Alert.alert("Listo", "Ya recibirás avisos de ANIMA.")
      } else if (asked === "denied") {
        const again = await Notifications.getPermissionsAsync()
        const canAskAgain = typeof again.canAskAgain === "boolean" ? again.canAskAgain : null
        if (canAskAgain === false) {
          Alert.alert(
            "Notificaciones desactivadas",
            "Para recibir avisos activa las notificaciones en Ajustes.",
            [
              { text: "Cerrar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
            ],
          )
        }
      }
    } catch (err) {
      console.warn("[HOME] Notification permission request failed:", err)
      Alert.alert("Error", "No se pudo solicitar el permiso. Prueba desde Ajustes de la app.")
    } finally {
      setNotificationPromptLoading(false)
    }
  }, [refreshNotificationPermission, syncPushToken])

  useEffect(() => {
    if (!userId) {
      notificationsPromptAttemptedForUserRef.current = null
      notificationsPromptInFlightRef.current = false
      return
    }
    if (authIsLoading) return
    if (!initialLoadDone) return
    if (notificationsPromptAttemptedForUserRef.current === userId) return
    if (notificationsPromptInFlightRef.current) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || notificationsPromptInFlightRef.current) return
        notificationsPromptInFlightRef.current = true
        try {
          const permissions = await Notifications.getPermissionsAsync()
          if (permissions.status === "granted") {
            await syncPushToken()
            return
          }
          if (permissions.status === "undetermined") {
            const asked = await Notifications.requestPermissionsAsync()
            if (asked.status === "granted") {
              await syncPushToken()
            }
          }
        } catch (err) {
          console.warn("[HOME] Notification permission flow skipped:", err)
        } finally {
          notificationsPromptInFlightRef.current = false
          if (!cancelled) {
            notificationsPromptAttemptedForUserRef.current = userId
          }
        }
      })()
    }, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [userId, authIsLoading, initialLoadDone, dependencyKey, syncPushToken])

  return {
    notificationPermissionStatus,
    notificationPromptLoading,
    requestNotificationPermissionOrOpenSettings,
  }
}
