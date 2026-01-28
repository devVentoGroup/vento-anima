import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Platform } from "react-native"
import { COLORS } from "@/constants/colors"
import { useAuth } from "@/contexts/auth-context"

export default function AppLayout() {
  const { employee } = useAuth()
  const role = employee?.role ?? null
  const canSeeTeam =
    role === "propietario" || role === "gerente_general" || role === "gerente"

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,

        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.neutral,

        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
        },

        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,

          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 12 : 10,
          height: Platform.OS === "ios" ? 78 : 72,

          // iOS shadow
          shadowColor: COLORS.shadow ?? COLORS.text,
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },

          // Android elevation
          elevation: 12,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Check-in",
          tabBarLabel: "Check-in",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarLabel: "Historial",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "time" : "time-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="documents"
        options={{
          title: "Documentos",
          tabBarLabel: "Documentos",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />


      <Tabs.Screen
        name="team"
        options={{
          title: "Equipo",
          tabBarLabel: "Equipo",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
          ...(canSeeTeam
            ? {}
            : {
                href: null,
              }),
        }}
      />

      <Tabs.Screen
        name="support"
        options={{
          title: "Soporte",
          tabBarLabel: "Soporte",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "help-circle" : "help-circle-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="announcements"
        options={{
          title: "Novedades",
          tabBarLabel: "Novedades",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={size ?? 22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}




