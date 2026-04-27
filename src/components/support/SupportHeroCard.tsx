import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import { SUPPORT_UI } from "./ui";

type Props = {
  canContactWorker: boolean;
  ticketCount: number;
  hasSelectedTicket: boolean;
  onCreateTicket: () => void;
  onSendNotice: () => void;
  onStartConversation: () => void;
};

export function SupportHeroCard({
  canContactWorker,
  ticketCount,
  hasSelectedTicket,
  onCreateTicket,
  onSendNotice,
  onStartConversation,
}: Props) {
  return (
    <View style={[SUPPORT_UI.card, { padding: 18 }]}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.text }}>Soporte</Text>
      <Text style={{ marginTop: 6, fontSize: 13, color: COLORS.neutral, lineHeight: 19 }}>
        Crea tickets, conversa en el hilo interno y resuelve novedades sin salir de la app.
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 16,
            padding: 12,
            backgroundColor: COLORS.porcelainAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 11, color: COLORS.neutral }}>Tickets</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 6 }}>
            {ticketCount}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 16,
            padding: 12,
            backgroundColor: hasSelectedTicket ? "rgba(226, 0, 106, 0.08)" : COLORS.porcelainAlt,
            borderWidth: 1,
            borderColor: hasSelectedTicket ? "rgba(226, 0, 106, 0.18)" : COLORS.border,
          }}
        >
          <Text style={{ fontSize: 11, color: COLORS.neutral }}>Chat activo</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 6 }}>
            {hasSelectedTicket ? "Sí" : "No"}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <TouchableOpacity
          onPress={onCreateTicket}
          style={[
            SUPPORT_UI.chip,
            {
              flex: 1,
              borderColor: COLORS.accent,
              backgroundColor: "rgba(226, 0, 106, 0.12)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            },
          ]}
        >
          <Ionicons name="create-outline" size={16} color={COLORS.accent} />
          <Text style={{ fontWeight: "800", color: COLORS.accent }}>Crear ticket</Text>
        </TouchableOpacity>
      </View>

      {canContactWorker ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            onPress={onSendNotice}
            style={[
              SUPPORT_UI.chip,
              {
                flex: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              },
            ]}
          >
            <Ionicons name="megaphone-outline" size={16} color={COLORS.text} />
            <Text style={{ fontWeight: "700", color: COLORS.text }}>Enviar aviso</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onStartConversation}
            style={[
              SUPPORT_UI.chip,
              {
                flex: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              },
            ]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.text} />
            <Text style={{ fontWeight: "700", color: COLORS.text }}>Conversación</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
