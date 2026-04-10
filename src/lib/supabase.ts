import { createClient } from "@supabase/supabase-js"
import * as SecureStore from "expo-secure-store"
import { AppState, type AppStateStatus } from "react-native"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

function isIosInteractionBlockedError(error: unknown) {
  const message = String((error as any)?.message ?? "").toLowerCase()
  return (
    message.includes("user interaction is not allowed") ||
    message.includes("getvaluewithkeyasync") ||
    message.includes("setvaluewithkeyasync")
  )
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch (error) {
      if (isIosInteractionBlockedError(error)) {
        console.warn(`[AUTH][SecureStore] getItem bloqueado para ${key} (background/locked).`)
        return null
      }
      throw error
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch (error) {
      if (isIosInteractionBlockedError(error)) {
        console.warn(`[AUTH][SecureStore] setItem bloqueado para ${key} (background/locked).`)
        return
      }
      throw error
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (error) {
      if (isIosInteractionBlockedError(error)) {
        console.warn(`[AUTH][SecureStore] removeItem bloqueado para ${key} (background/locked).`)
        return
      }
      throw error
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

let authRefreshAppStateSub: { remove: () => void } | null = null

function syncSupabaseAutoRefresh(state: AppStateStatus) {
  if (state === "active") {
    supabase.auth.startAutoRefresh()
    return
  }
  supabase.auth.stopAutoRefresh()
}

if (!authRefreshAppStateSub) {
  syncSupabaseAutoRefresh(AppState.currentState)
  authRefreshAppStateSub = AppState.addEventListener("change", syncSupabaseAutoRefresh)
}
