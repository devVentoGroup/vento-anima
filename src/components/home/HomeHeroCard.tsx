import { Image, Text, TouchableOpacity, View } from "react-native";

import { PALETTE, RGBA } from "@/components/home/theme";

type HomeHeroCardProps = {
  cardStyle: object;
  pillStyle: object;
  todayLabel: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  avatarInitial: string;
  statusUI: {
    label: string;
    tone: "active" | "done" | "idle";
  };
  geofenceUI: {
    label: string;
  };
  geofencePill: {
    bg: string;
    border: string;
    text: string;
  };
  showGeofencePill: boolean;
  showConnectivityPill: boolean;
  hasPendingAny: boolean;
  isSyncingAny: boolean;
  pendingCount: number;
  showPendingPill: boolean;
  showHeaderOpsPill: boolean;
  headerOpsPill: {
    label: string;
    bg: string;
    border: string;
    text: string;
  };
  onOpenUserMenu: () => void;
  onPressOpsPill: () => void;
};

export function HomeHeroCard({
  cardStyle,
  pillStyle,
  todayLabel,
  displayName,
  avatarUrl,
  avatarInitial,
  statusUI,
  geofenceUI,
  geofencePill,
  showGeofencePill,
  showConnectivityPill,
  hasPendingAny,
  isSyncingAny,
  pendingCount,
  showPendingPill,
  showHeaderOpsPill,
  headerOpsPill,
  onOpenUserMenu,
  onPressOpsPill,
}: HomeHeroCardProps) {
  const secondaryPill = showConnectivityPill
    ? {
        label: "Sin conexión",
        borderColor: RGBA.borderPink,
        backgroundColor: "rgba(226, 0, 106, 0.08)",
        textColor: PALETTE.accent,
      }
    : showPendingPill
      ? {
          label: hasPendingAny ? `${pendingCount} pendientes` : "Sincronizando",
          borderColor: hasPendingAny ? RGBA.borderPink : PALETTE.border,
          backgroundColor: hasPendingAny ? "rgba(226, 0, 106, 0.08)" : PALETTE.porcelain2,
          textColor: hasPendingAny ? PALETTE.accent : PALETTE.neutral,
        }
      : showGeofencePill
        ? {
            label: geofenceUI.label,
            borderColor: geofencePill.border,
            backgroundColor: geofencePill.bg,
            textColor: geofencePill.text,
          }
        : null;

  return (
    <View
      style={{
        ...cardStyle,
        padding: 16,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -36,
          right: -28,
          width: 132,
          height: 132,
          borderRadius: 66,
          backgroundColor: RGBA.washPink,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -44,
          left: -34,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: RGBA.cardTint,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: PALETTE.neutral,
              letterSpacing: 0.1,
            }}
          >
            {todayLabel}
          </Text>
          <Text
            style={{
              fontSize: 31,
              fontWeight: "800",
              color: PALETTE.text,
              marginTop: 4,
              lineHeight: 34,
            }}
            numberOfLines={1}
          >
            Hola, {displayName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onOpenUserMenu}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú de usuario"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: PALETTE.porcelain2,
            borderWidth: 1,
            borderColor: PALETTE.border,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: "900", color: PALETTE.text }}>
              {avatarInitial}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: statusUI.tone === "active" ? RGBA.borderPink : PALETTE.border,
          backgroundColor:
            statusUI.tone === "active" ? "rgba(242, 198, 192, 0.18)" : PALETTE.porcelain2,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: PALETTE.neutral,
            letterSpacing: 0.1,
          }}
        >
          Estado de hoy
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: statusUI.tone === "active" ? PALETTE.accent : PALETTE.text,
            marginTop: 3,
          }}
        >
          {statusUI.label}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        {secondaryPill ? (
          <View
            style={{
              ...pillStyle,
              borderColor: secondaryPill.borderColor,
              backgroundColor: secondaryPill.backgroundColor,
            }}
          >
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: "700",
                color: secondaryPill.textColor,
                letterSpacing: 0.1,
              }}
            >
              {secondaryPill.label}
            </Text>
          </View>
        ) : null}

        {showHeaderOpsPill ? (
          <TouchableOpacity
            onPress={onPressOpsPill}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              ...pillStyle,
              backgroundColor: headerOpsPill.bg,
              borderColor: headerOpsPill.border,
            }}
          >
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: "700",
                color: headerOpsPill.text,
                letterSpacing: 0.1,
              }}
            >
              {headerOpsPill.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
