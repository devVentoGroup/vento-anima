import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AppState, Linking, Platform } from "react-native"
import * as Updates from "expo-updates"
import Constants from "expo-constants"

import { supabase } from "@/lib/supabase"

type UpdateStatus = "none" | "required" | "optional"

export interface AppUpdateInfo {
  status: UpdateStatus
  title: string
  message: string
  storeUrl: string | null
  currentVersion: string | null
  targetVersion: string | null
  loading: boolean
}

const DEFAULT_STATE: AppUpdateInfo = {
  status: "none",
  title: "",
  message: "",
  storeUrl: null,
  currentVersion: null,
  targetVersion: null,
  loading: true,
}

function parseVersion(value: string | null | undefined): number[] {
  if (!value || typeof value !== "string") return [0]
  const chunks = value
    .trim()
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))

  return chunks.length > 0 ? chunks : [0]
}

function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const aParts = parseVersion(a)
  const bParts = parseVersion(b)
  const maxLength = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < maxLength; i += 1) {
    const left = aParts[i] ?? 0
    const right = bParts[i] ?? 0
    if (left > right) return 1
    if (left < right) return -1
  }

  return 0
}

function getInstalledVersion(): string {
  const runtimeVersion = typeof Updates.runtimeVersion === "string" ? Updates.runtimeVersion : null
  const expoConfigVersion =
    typeof Constants?.expoConfig?.version === "string" ? Constants.expoConfig.version : null

  return runtimeVersion || expoConfigVersion || "0.0.0"
}

function normalizeStoreUrl(
  value: string | null | undefined,
  platform: "ios" | "android" | null,
): string | null {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Guard against placeholders that can break forced-update UX in production.
  if (trimmed.includes("id0000000000")) return null

  if (platform === "ios" && trimmed.startsWith("https://apps.apple.com/")) {
    return trimmed.replace("https://", "itms-apps://")
  }

  return trimmed
}

export function useAppUpdatePolicy(appKey: string) {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo>(DEFAULT_STATE)
  const [optionalDismissedVersion, setOptionalDismissedVersion] = useState<string | null>(null)

  const platform = useMemo(() => {
    if (Platform.OS === "ios") return "ios"
    if (Platform.OS === "android") return "android"
    return null
  }, [])

  const openStore = useCallback(async () => {
    if (!updateInfo.storeUrl) {
      Alert.alert("Actualización", "No encontramos un enlace válido de tienda para esta versión.")
      return
    }

    const candidates =
      Platform.OS === "ios" && updateInfo.storeUrl.startsWith("itms-apps://")
        ? [updateInfo.storeUrl, updateInfo.storeUrl.replace("itms-apps://", "https://")]
        : [updateInfo.storeUrl]

    try {
      for (const url of candidates) {
        const canOpen = await Linking.canOpenURL(url)
        if (!canOpen) continue
        await Linking.openURL(url)
        return
      }

      Alert.alert("Actualización", "No pudimos abrir la tienda en este dispositivo.")
    } catch (error) {
      console.error("[update] No se pudo abrir URL de tienda:", error)
      Alert.alert("Actualización", "No pudimos abrir la tienda. Intenta manualmente.")
    }
  }, [updateInfo.storeUrl])

  const dismissOptionalUpdate = useCallback(() => {
    if (updateInfo.status !== "optional") return

    setOptionalDismissedVersion(updateInfo.targetVersion ?? updateInfo.currentVersion ?? null)
    setUpdateInfo((prev) => ({ ...prev, status: "none" }))
  }, [updateInfo.currentVersion, updateInfo.status, updateInfo.targetVersion])

  const checkForUpdate = useCallback(async () => {
    if (!appKey || !platform) {
      setUpdateInfo({ ...DEFAULT_STATE, loading: false })
      return
    }

    const currentVersion = getInstalledVersion()

    const appVariant =
      typeof Constants?.expoConfig?.extra?.appVariant === "string"
        ? String(Constants.expoConfig.extra.appVariant).toLowerCase()
        : null
    const isDevelopmentRuntime = __DEV__ || appVariant === "development" || appKey.endsWith("_dev")
    if (isDevelopmentRuntime) {
      setUpdateInfo({ ...DEFAULT_STATE, currentVersion, loading: false })
      return
    }

    setUpdateInfo((prev) => ({ ...prev, loading: true, currentVersion }))

    try {
      const { data, error } = await supabase
        .from("app_update_policies")
        .select(
          "min_version, latest_version, force_update, store_url, title, message, app_key, platform, is_enabled",
        )
        .eq("app_key", appKey)
        .eq("platform", platform)
        .eq("is_enabled", true)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        setUpdateInfo({ ...DEFAULT_STATE, currentVersion, loading: false })
        return
      }

      const minVersion =
        typeof data.min_version === "string" && data.min_version.trim().length > 0
          ? data.min_version.trim()
          : "0.0.0"
      const latestVersion =
        typeof data.latest_version === "string" && data.latest_version.trim().length > 0
          ? data.latest_version.trim()
          : null
      const storeUrl = normalizeStoreUrl(
        typeof data.store_url === "string" ? data.store_url : null,
        platform,
      )

      const belowMin = compareVersions(currentVersion, minVersion) < 0
      const behindLatest =
        latestVersion != null ? compareVersions(currentVersion, latestVersion) < 0 : false
      const shouldForce = Boolean(data.force_update) && behindLatest
      const requiredByPolicy = belowMin || shouldForce
      const required = requiredByPolicy && Boolean(storeUrl)
      const optional = !required && behindLatest
      const targetVersion = latestVersion || minVersion

      if (optional && optionalDismissedVersion && optionalDismissedVersion === targetVersion) {
        setUpdateInfo({
          ...DEFAULT_STATE,
          currentVersion,
          targetVersion,
          loading: false,
        })
        return
      }

      setUpdateInfo({
        status: required ? "required" : optional ? "optional" : "none",
        title:
          (typeof data.title === "string" && data.title.trim()) ||
          (required ? "Actualización obligatoria" : "Actualización disponible"),
        message:
          (typeof data.message === "string" && data.message.trim()) ||
          (required
            ? "Para continuar debes actualizar a la versión más reciente."
            : "Hay una nueva versión disponible con mejoras y correcciones."),
        storeUrl,
        currentVersion,
        targetVersion,
        loading: false,
      })
    } catch (error) {
      console.warn("[update] Error consultando política de actualización:", error)
      setUpdateInfo({ ...DEFAULT_STATE, currentVersion, loading: false })
    }
  }, [appKey, optionalDismissedVersion, platform])

  useEffect(() => {
    void checkForUpdate()
  }, [checkForUpdate])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkForUpdate()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [checkForUpdate])

  return {
    updateInfo,
    checkForUpdate,
    dismissOptionalUpdate,
    openStore,
  }
}
