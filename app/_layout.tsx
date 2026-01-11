import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { AuthProvider } from "@/contexts/auth-context"
export const unstable_settings = {
  initialRouteName: "(auth)/splash",
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Stack initialRouteName="(auth)/splash" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)/splash" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>

        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

