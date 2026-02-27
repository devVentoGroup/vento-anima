import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AuthProvider } from "@/contexts/auth-context"
import { AttendanceProvider } from "@/contexts/attendance-context"
import { AppUpdateGate } from "@/components/AppUpdateGate"
import { useAppUpdatePolicy } from "@/hooks/use-app-update-policy"

export default function RootLayout() {
  const { updateInfo, openStore, dismissOptionalUpdate } = useAppUpdatePolicy("vento_anima")

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
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
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
