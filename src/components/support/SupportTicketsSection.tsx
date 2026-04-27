import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import type { MessageRow, TicketRow, TicketStatus } from "./types";
import { SUPPORT_UI } from "./ui";

type Props = {
  tickets: TicketRow[];
  isLoadingTickets: boolean;
  selectedTicketId: string | null;
  selectedTicket: TicketRow | null;
  messages: MessageRow[];
  isLoadingMessages: boolean;
  newMessage: string;
  isSendingMessage: boolean;
  onSelectTicket: (ticketId: string) => void;
  onChangeNewMessage: (value: string) => void;
  onSendMessage: () => void;
  formatDateTime: (value: string) => string;
  statusMeta: (status: TicketStatus) => { label: string; color: string; bg: string };
  currentUserId: string | undefined;
};

export function SupportTicketsSection({
  tickets,
  isLoadingTickets,
  selectedTicketId,
  selectedTicket,
  messages,
  isLoadingMessages,
  newMessage,
  isSendingMessage,
  onSelectTicket,
  onChangeNewMessage,
  onSendMessage,
  formatDateTime,
  statusMeta,
  currentUserId,
}: Props) {
  return (
    <>
      <View style={[SUPPORT_UI.card, { padding: 14 }]}>
        <Text style={styles.cardTitle}>Tickets</Text>
        <Text style={styles.cardSubtitle}>Selecciona uno para abrir el chat interno.</Text>

        {isLoadingTickets ? (
          <View style={{ marginTop: 14, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {!isLoadingTickets && tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tienes tickets abiertos. Crea uno para iniciar el chat.</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 12, gap: 10 }}>
          {tickets.map((ticket) => {
            const status = statusMeta(ticket.status);
            const active = selectedTicketId === ticket.id;
            return (
              <TouchableOpacity
                key={ticket.id}
                onPress={() => onSelectTicket(ticket.id)}
                style={[
                  SUPPORT_UI.row,
                  {
                    borderColor: active ? COLORS.accent : COLORS.border,
                    backgroundColor: active ? "rgba(226, 0, 106, 0.06)" : COLORS.white,
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontWeight: "800", color: COLORS.text }}>{ticket.title}</Text>
                  <Text style={styles.ticketMeta}>
                    {ticket.siteName ?? "Sin sede"} · {formatDateTime(ticket.updated_at)}
                  </Text>
                </View>
                <View style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: status.bg }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: status.color }}>{status.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {selectedTicket ? (
        <View style={[SUPPORT_UI.card, { padding: 14 }]}>
          <Text style={styles.cardTitle}>Chat interno</Text>
          <Text style={styles.cardSubtitle}>Ticket: {selectedTicket.title}</Text>

          {isLoadingMessages ? (
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 8, maxHeight: 300 }}>
              {messages.length === 0 ? (
                <Text style={styles.emptyText}>Aún no hay mensajes en este ticket.</Text>
              ) : (
                messages.map((message) => {
                  const isOwn = message.author_id === currentUserId;
                  return (
                    <View
                      key={message.id}
                      style={{
                        alignSelf: isOwn ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isOwn ? COLORS.accent : COLORS.border,
                        backgroundColor: isOwn ? "rgba(226, 0, 106, 0.10)" : COLORS.porcelainAlt,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: COLORS.text, fontSize: 13 }}>{message.body}</Text>
                      <Text style={{ marginTop: 4, color: COLORS.neutral, fontSize: 10 }}>
                        {formatDateTime(message.created_at)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <TextInput
              value={newMessage}
              onChangeText={onChangeNewMessage}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={COLORS.neutral}
              style={styles.messageInput}
            />
            <TouchableOpacity
              onPress={onSendMessage}
              disabled={isSendingMessage || !newMessage.trim()}
              style={[
                SUPPORT_UI.chip,
                {
                  borderColor: COLORS.accent,
                  backgroundColor: "rgba(226, 0, 106, 0.12)",
                  justifyContent: "center",
                  opacity: isSendingMessage || !newMessage.trim() ? 0.6 : 1,
                },
              ]}
            >
              {isSendingMessage ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons name="send-outline" size={16} color={COLORS.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = {
  cardTitle: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
  emptyState: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
  },
  emptyText: {
    color: COLORS.neutral,
    fontSize: 12,
  },
  ticketMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  messageInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },
};
