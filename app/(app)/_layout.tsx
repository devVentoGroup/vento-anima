import { Tabs } from "expo-router"
import { COLORS } from "@/constants/colors"

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.porcelain,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.neutral,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Check-In",
          tabBarLabel: "Check-In",
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarLabel: "Historial",
        }}
      />

      <Tabs.Screen
        name="documents"
        options={{
          title: "Documentos",
          tabBarLabel: "Docs",
        }}
      />
    </Tabs>
  )
}
