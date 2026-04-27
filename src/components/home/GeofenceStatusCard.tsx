import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { PALETTE } from "@/components/home/theme"
import { COLORS } from "@/constants/colors"

type GeofencePill = {
  bg: string
  border: string
  text: string
}

type GeofenceStatusCardProps = {
  cardStyle: object
  cardTintStyle: object
  pillStyle: object
  buttonGhostStyle: object
  geofencePill: GeofencePill
  geofenceLabel: string
  activeSiteName: string
  isCheckedIn: boolean
  isLoading: boolean
  isGeoChecking: boolean
  isCheckActionLocked: boolean
  canChooseSite: boolean
  statusTitle: string
  supportMessage: string | null
  onRefresh: () => void
  onSelectSite: () => void
}

function getVisualTone(label: string) {
  const normalized = label.trim().toLowerCase()

  if (normalized.includes("listo") || normalized.includes("verificada")) {
    return {
      icon: "checkmark-circle" as const,
      iconBg: "rgba(20, 136, 97, 0.10)",
      iconColor: "#148861",
      accentBg: "rgba(20, 136, 97, 0.08)",
      accentBorder: "rgba(20, 136, 97, 0.18)",
    }
  }

  if (
    normalized.includes("conex") ||
    normalized.includes("revisa") ||
    normalized.includes("pendiente")
  ) {
    return {
      icon: "alert-circle" as const,
      iconBg: "rgba(226, 0, 106, 0.10)",
      iconColor: PALETTE.accent,
      accentBg: "rgba(226, 0, 106, 0.06)",
      accentBorder: "rgba(226, 0, 106, 0.16)",
    }
  }

  return {
    icon: "locate" as const,
    iconBg: "rgba(183, 110, 121, 0.12)",
    iconColor: "#9B5C66",
    accentBg: "rgba(242, 198, 192, 0.18)",
    accentBorder: "rgba(183, 110, 121, 0.18)",
  }
}

export function GeofenceStatusCard({
  cardStyle,
  cardTintStyle,
  pillStyle,
  buttonGhostStyle,
  geofencePill,
  geofenceLabel,
  activeSiteName,
  isCheckedIn,
  isLoading,
  isGeoChecking,
  isCheckActionLocked,
  canChooseSite,
  statusTitle,
  supportMessage,
  onRefresh,
  onSelectSite,
}: GeofenceStatusCardProps) {
  const tone = getVisualTone(statusTitle)
  const actionDisabled = isLoading || isGeoChecking || isCheckActionLocked

  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          ...cardStyle,
          padding: 18,
          marginBottom: 12,
          overflow: "hidden",
        }}
      >
        <View pointerEvents="none" style={cardTintStyle} />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -30,
            right: -24,
            width: 118,
            height: 118,
            borderRadius: 59,
            backgroundColor: tone.accentBg,
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: tone.iconBg,
              borderWidth: 1,
              borderColor: tone.accentBorder,
            }}
          >
            <Ionicons name={tone.icon} size={22} color={tone.iconColor} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                ...pillStyle,
                alignSelf: "flex-start",
                marginBottom: 10,
                backgroundColor: geofencePill.bg,
                borderColor: geofencePill.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 0.4,
                  color: geofencePill.text,
                }}
              >
                {geofenceLabel}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: COLORS.text,
                lineHeight: 24,
              }}
            >
              {statusTitle}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: PALETTE.text,
                marginTop: 6,
              }}
            >
              {activeSiteName}
            </Text>
            {supportMessage ? (
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.neutral,
                  marginTop: 6,
                  lineHeight: 16,
                }}
              >
                {supportMessage}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            marginTop: 14,
            padding: 13,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tone.accentBorder,
            backgroundColor: tone.accentBg,
          }}
        >
          <Text style={{ fontSize: 11, color: COLORS.neutral, marginBottom: 4 }}>
            {isCheckedIn ? "Registrando salida desde" : "Registrando entrada desde"}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: COLORS.text,
            }}
          >
            {activeSiteName}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
          }}
        >
          <TouchableOpacity
            onPress={onRefresh}
            disabled={actionDisabled}
            style={{
              ...buttonGhostStyle,
              flex: canChooseSite ? 1 : undefined,
              alignItems: "center",
              justifyContent: "center",
              opacity: actionDisabled ? 0.6 : 1,
            }}
          >
            {isGeoChecking ? (
              <ActivityIndicator color={PALETTE.accent} />
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: PALETTE.accent,
                }}
              >
                {isCheckedIn ? "Revisar ubicación" : "Actualizar ubicación"}
              </Text>
            )}
          </TouchableOpacity>

          {canChooseSite ? (
            <TouchableOpacity
              onPress={onSelectSite}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tone.accentBorder,
                backgroundColor: PALETTE.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: PALETTE.text,
                }}
              >
                Cambiar sede
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {canChooseSite ? (
          <Text
            style={{
              fontSize: 11,
              color: COLORS.neutral,
              marginTop: 10,
              lineHeight: 15,
            }}
          >
            {isCheckedIn
              ? "Si cambias de sede, vuelve a revisar la ubicación antes de registrar la salida."
              : "Si hoy te corresponde otra sede, cámbiala antes de registrar."}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
