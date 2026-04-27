import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"

import { PALETTE, RGBA } from "@/components/home/theme"

type AttendanceActionCardProps = {
  cardStyle: object
  cardTintStyle: object
  canRegister: boolean
  isLoading: boolean
  isGeoChecking: boolean
  isCheckActionLocked: boolean
  ctaTextColor: string
  ctaPrimaryLabel: string
  ctaSecondaryLabel: string | null
  onCheck: () => void
}

export function AttendanceActionCard({
  cardStyle,
  cardTintStyle,
  canRegister,
  isLoading,
  isGeoChecking,
  isCheckActionLocked,
  ctaTextColor,
  ctaPrimaryLabel,
  ctaSecondaryLabel,
  onCheck,
}: AttendanceActionCardProps) {
  return (
    <View style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
      <View pointerEvents="none" style={cardTintStyle} />
      <TouchableOpacity
        onPress={onCheck}
        disabled={!canRegister}
        style={[
          {
            borderRadius: 20,
            paddingVertical: 18,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canRegister ? PALETTE.accent : RGBA.ctaDisabled,
            borderWidth: canRegister ? 0 : 1,
            borderColor: canRegister ? "transparent" : PALETTE.border,
            shadowColor: canRegister ? PALETTE.accent : "transparent",
            shadowOpacity: canRegister ? 0.3 : 0,
            shadowRadius: canRegister ? 12 : 0,
            shadowOffset: { width: 0, height: 6 },
            elevation: canRegister ? 6 : 0,
            minHeight: 64,
          },
        ]}
        activeOpacity={0.85}
      >
        {isLoading || isGeoChecking || isCheckActionLocked ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={ctaTextColor} size="small" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: ctaTextColor,
                letterSpacing: 0.3,
              }}
            >
              {ctaPrimaryLabel}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: ctaTextColor,
                opacity: canRegister ? 0.95 : 0.6,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {ctaPrimaryLabel}
            </Text>

            {ctaSecondaryLabel ? (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: ctaTextColor,
                  letterSpacing: 0.2,
                }}
              >
                {ctaSecondaryLabel}
              </Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}
