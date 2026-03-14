import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import Constants from "expo-constants"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AuthProvider } from "@/contexts/auth-context"
import { AppConfigProvider } from "@/contexts/app-config-context"
import { AttendanceProvider } from "@/contexts/attendance-context"
import { AppUpdateGate } from "@/components/AppUpdateGate"
import { useAppUpdatePolicy } from "@/hooks/use-app-update-policy"

export default function RootLayout() {
  const configuredAppUpdateKey = Constants.expoConfig?.extra?.appUpdateKey as string | undefined
  const fallbackAppUpdateKey = __DEV__ ? "vento_anima_dev" : "vento_anima"
  const appUpdateKey = configuredAppUpdateKey ?? fallbackAppUpdateKey
  const { updateInfo, openStore, dismissOptionalUpdate } = useAppUpdatePolicy(appUpdateKey)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppConfigProvider>
          <AttendanceProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Screen name="(auth)" options={{ animation: "none" }} />
              <Stack.Screen name="(app)" />
            </Stack>
            <AppUpdateGate
              updateInfo={updateInfo}
              onUpdatePress={() => {
                void openStore()
              }}
              onDismissOptional={dismissOptionalUpdate}
            />
          </AttendanceProvider>
          </AppConfigProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
