import { useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { COLORS } from "../../constants/colors"
import { useAuth } from "../../contexts/auth-context"
import { useAttendance } from "../../hooks/use-attendance"

function formatClock(value: string | null) {
  if (!value) return "--:--"
  return new Date(value).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user, employee, signOut } = useAuth()
  const {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    loadTodayAttendance,
    checkIn,
    checkOut,
  } = useAttendance()

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isCheckedIn = attendanceState.status === "checked_in"
  const isGeoChecking = geofenceState.status === "checking"
  const canRegister = !isLoading && !isOffline && geofenceState.canProceed && !isGeoChecking
  const ctaTextColor = canRegister ? "white" : COLORS.text
  const ctaSubTextOpacity = canRegister ? 0.9 : 0.7

  useEffect(() => {
    if (!user) return
    void loadTodayAttendance()
    void refreshGeofence({ force: true })
  }, [user, loadTodayAttendance, refreshGeofence])

  useEffect(() => {
    if (!user) return
    void refreshGeofence({ force: true })
  }, [attendanceState.status, user, refreshGeofence])

  const displayName =
    employee?.alias || employee?.fullName?.split(" ")[0] || user?.email?.split("@")[0] || "Usuario"
  const siteName = attendanceState.currentSiteName || employee?.siteName || "Sin sede asignada"
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U"

  const todayLabel = useMemo(() => {
    const now = new Date()
    const day = now.toLocaleDateString("es-CO", { weekday: "long" })
    const date = now.toLocaleDateString("es-CO", { day: "2-digit", month: "long" })
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${date}`
  }, [])

  const statusUI = useMemo(() => {
    if (attendanceState.status === "checked_in") {
      return { label: "EN TURNO", hint: "Registro activo", tone: "active" as const }
    }
    if (attendanceState.status === "checked_out") {
      return { label: "JORNADA CERRADA", hint: "Listo por hoy", tone: "done" as const }
    }
    return { label: "SIN INICIAR", hint: "Registra tu entrada", tone: "idle" as const }
  }, [attendanceState.status])
  const geofenceUI = useMemo(() => {
    if (geofenceState.status === "ready") return { label: "VERIFICADA", highlight: true }
    if (geofenceState.status === "checking") return { label: "VERIFICANDO", highlight: false }
    if (geofenceState.status === "blocked") return { label: "BLOQUEADA", highlight: false }
    if (geofenceState.status === "error") return { label: "ERROR", highlight: false }
    return { label: "PENDIENTE", highlight: false }
  }, [geofenceState.status])

  const totalMinutes = Math.round(attendanceState.todayHours * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hoursLabel = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`

  const lastCheckIn = formatClock(attendanceState.lastCheckIn)
  const lastCheckOut = formatClock(attendanceState.lastCheckOut)

  const handleRefresh = async () => {
    if (!user) return
    setIsRefreshing(true)
    setActionError(null)
    try {
      await loadTodayAttendance()
      await refreshGeofence({ force: true })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCheck = async () => {
    if (isLoading) return
    if (isGeoChecking) return

    setActionError(null)

    if (isOffline) {
      setActionError("Sin conexión. Revisa tu internet e intenta de nuevo.")
      return
    }

    // Si aún no está listo, fuerza verificación antes de registrar
    const geo = geofenceState.canProceed ? geofenceState : await refreshGeofence({ force: true })

    if (!geo.canProceed) {
      const msg = geo.message || "Ubicación no verificada"
      setActionError(msg)
      Alert.alert("No se puede registrar", msg)
      return
    }

    const result = isCheckedIn ? await checkOut() : await checkIn()
    if (!result.success) {
      setActionError(result.error || "No se pudo completar la acción")
    }
  }

  const handleSignOut = async () => {
    setIsUserMenuOpen(false)
    await signOut()
  }

  const handleSoon = (title: string) => {
    Alert.alert(title, "Esta sección estará disponible pronto.")
  }

  const topPadding = Math.max(20, insets.top + 12)

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.porcelain }}>
      {/* User menu */}
      <Modal
        transparent
        visible={isUserMenuOpen}
        animationType="fade"
        onRequestClose={() => setIsUserMenuOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }}
          onPress={() => setIsUserMenuOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              top: topPadding + 44,
              right: 20,
              backgroundColor: "white",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.10,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
              minWidth: 220,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setIsUserMenuOpen(false)
                void handleRefresh()
              }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>Actualizar</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}>
                Recargar estado de hoy
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: COLORS.border }} />

            <TouchableOpacity
              onPress={() => {
                setIsUserMenuOpen(false)
                handleSoon("Mi perfil")
              }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>Mi perfil</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}>
                Datos y preferencias
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: COLORS.border }} />

            <TouchableOpacity onPress={handleSignOut} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text }}>
                Cerrar sesión
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}>Salir de ANIMA</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: topPadding }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 13, color: COLORS.neutral }}>{todayLabel}</Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 10 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.text }}>
                Hola, {displayName}
              </Text>

              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: statusUI.tone === "active" ? COLORS.accent : COLORS.border,
                  backgroundColor: "white",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: statusUI.tone === "active" ? COLORS.accent : COLORS.neutral,
                    letterSpacing: 0.4,
                  }}
                >
                  {statusUI.label}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, color: COLORS.neutral, marginTop: 6 }}>{siteName}</Text>
          </View>

          <TouchableOpacity
            onPress={() => setIsUserMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de usuario"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: COLORS.border,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {employee?.avatarUrl ? (
              <Image
                source={{ uri: employee.avatarUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}>{avatarInitial}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Connectivity / error banners */}
        {isOffline ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>Sin conexión</Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              No pudimos actualizar tu jornada. Revisa tu conexión e intenta de nuevo.
            </Text>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: COLORS.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "white" }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {actionError ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>No se pudo registrar</Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>{actionError}</Text>
          </View>
        ) : null}

        {/* Main day card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 13, color: COLORS.neutral }}>Mi jornada hoy</Text>

          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={{ fontSize: 52, fontWeight: "800", color: COLORS.text }}>{hoursLabel}</Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginLeft: 10, marginBottom: 10 }}>horas</Text>
          </View>

          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>{statusUI.hint}</Text>

          <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 16 }} />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: COLORS.porcelain,
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>Entrada</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 8 }}>{lastCheckIn}</Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: COLORS.porcelain,
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>Salida</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 8 }}>{lastCheckOut}</Text>
            </View>
          </View>
        </View>

        {/* Primary action */}
        <View style={{ marginTop: 18 }}>
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>Verificación de ubicación</Text>

              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: geofenceUI.highlight ? COLORS.accent : COLORS.border,
                  backgroundColor: "white",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                    color: geofenceUI.highlight ? COLORS.accent : COLORS.neutral,
                  }}
                >
                  {geofenceUI.label}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>
                  {geofenceState.siteName || siteName}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                  {isCheckedIn ? "Para registrar salida" : "Para registrar entrada"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => refreshGeofence({ force: true })}
                disabled={isLoading || isGeoChecking}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: COLORS.accent,
                  opacity: isLoading || isGeoChecking ? 0.6 : 1,
                }}
              >
                {isGeoChecking ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>Actualizar</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.porcelain, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Distancia</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 8 }}>
                  {geofenceState.distanceMeters != null ? `${geofenceState.distanceMeters}m` : "—"}
                </Text>
              </View>

              <View style={{ flex: 1, backgroundColor: COLORS.porcelain, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Precisión</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 8 }}>
                  {geofenceState.accuracyMeters != null ? `${Math.round(geofenceState.accuracyMeters)}m` : "—"}
                </Text>
              </View>

              <View style={{ flex: 1, backgroundColor: COLORS.porcelain, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Radio</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 8 }}>
                  {geofenceState.effectiveRadiusMeters != null ? `${geofenceState.effectiveRadiusMeters}m` : "—"}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 12, lineHeight: 16 }}>
              {isOffline
                ? "Sin conexión: no podrás registrar asistencia."
                : geofenceState.status === "ready"
                  ? "Ubicación verificada. Ya puedes registrar."
                  : geofenceState.message || "Verifica tu ubicación para poder registrar."}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCheck}
            disabled={!canRegister}
            style={{
              backgroundColor: canRegister ? COLORS.accent : "rgba(0,0,0,0.10)",
              borderRadius: 18,
              paddingVertical: 16,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: canRegister ? "transparent" : COLORS.border,
            }}
          >
            {isLoading || isGeoChecking ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color={COLORS.text} />
                <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
                  {isGeoChecking ? "Verificando ubicación…" : "Registrando…"}
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: ctaTextColor,
                    opacity: ctaSubTextOpacity,
                  }}
                >
                  {isCheckedIn ? "Registrar salida" : "Registrar entrada"}
                </Text>

                <Text style={{ fontSize: 16, fontWeight: "800", color: ctaTextColor, marginTop: 6 }}>
                  {isCheckedIn ? "Terminar turno" : "Iniciar turno"}
                </Text>
              </View>

            )}
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: COLORS.neutral, textAlign: "center", marginTop: 10, lineHeight: 16 }}>
            {canRegister
              ? "Listo. Puedes registrar ahora."
              : isOffline
                ? "Sin conexión: no podrás registrar."
                : isGeoChecking
                  ? "Validando ubicación…"
                  : geofenceState.message || "Verifica tu ubicación para habilitar el registro."}
          </Text>
        </View>

        {/* Quick actions */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text, marginBottom: 10 }}>
            Accesos rápidos
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => handleSoon("Historial")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: COLORS.porcelain,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>H</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text, marginTop: 10 }}>Historial</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>Mis registros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSoon("Novedades")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: COLORS.porcelain,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>N</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text, marginTop: 10 }}>Novedades</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>Avisos del equipo</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => handleSoon("Soporte")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: COLORS.porcelain,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>S</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text, marginTop: 10 }}>Soporte</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>Reportar novedad</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSoon("Mi equipo")}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: COLORS.porcelain,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>E</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text, marginTop: 10 }}>Mi equipo</Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>Staff & sede</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  )
}
