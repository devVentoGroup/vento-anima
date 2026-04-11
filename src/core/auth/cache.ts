import * as SecureStore from "expo-secure-store"

export function getAuthCacheKey(userId: string, suffix: string) {
  return `auth_cache_${suffix}_${userId}`
}

export async function readAuthCache<T>(key: string): Promise<T | null> {
  try {
    const stored = await SecureStore.getItemAsync(key)
    if (!stored) return null
    return JSON.parse(stored) as T
  } catch (err) {
    console.warn("[AUTH] Cache read failed:", err)
    return null
  }
}

export async function writeAuthCache(key: string, value: unknown) {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value))
  } catch (err) {
    console.warn("[AUTH] Cache write failed:", err)
  }
}

export async function clearAuthCache(userId: string) {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(getAuthCacheKey(userId, "employee")),
      SecureStore.deleteItemAsync(getAuthCacheKey(userId, "sites")),
      SecureStore.deleteItemAsync(getAuthCacheKey(userId, "settings")),
    ])
  } catch (err) {
    console.warn("[AUTH] Cache clear failed:", err)
  }
}
