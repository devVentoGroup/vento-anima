import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"

import type { WalletEligibility } from "@/components/home/types"
import { PALETTE } from "@/components/home/theme"
import { COLORS } from "@/constants/colors"

type WalletCardProps = {
  eligibility: WalletEligibility | null
  isLoading: boolean
  isAdding: boolean
  onAdd: () => void
}

export function WalletCard({
  eligibility,
  isLoading,
  isAdding,
  onAdd,
}: WalletCardProps) {
  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: PALETTE.border,
          backgroundColor: COLORS.white,
          borderRadius: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={{ fontSize: 12, color: COLORS.neutral }}>Carnet laboral</Text>
            {isLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <ActivityIndicator size="small" color={PALETTE.accent} />
                <Text style={{ fontSize: 13, color: COLORS.neutral }}>Verificando…</Text>
              </View>
            ) : eligibility?.wallet_eligible ? (
              <Text style={{ fontSize: 13, color: PALETTE.text, marginTop: 4 }}>
                Añade tu credencial a Wallet
              </Text>
            ) : eligibility != null ? (
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
                numberOfLines={2}
              >
                {!eligibility.contract_active
                  ? "Contrato no vigente."
                  : !eligibility.documents_complete
                    ? "Faltan documentos requeridos."
                    : "No disponible."}
              </Text>
            ) : null}
          </View>

          {eligibility?.wallet_eligible ? (
            <TouchableOpacity
              onPress={onAdd}
              disabled={isAdding}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: PALETTE.accent,
                backgroundColor: "transparent",
              }}
              activeOpacity={0.7}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={PALETTE.accent} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: "600", color: PALETTE.accent }}>
                  Agregar a Wallet
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )
}
