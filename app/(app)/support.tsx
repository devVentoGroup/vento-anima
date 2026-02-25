import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import {
  CONTENT_HORIZONTAL_PADDING,
  CONTENT_MAX_WIDTH,
} from "@/constants/layout";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import { SUPPORT_UI } from "@/components/support/ui";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

const UI = SUPPORT_UI;

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  category: string;
  site_id: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  siteName: string | null;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type FaqItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
};

const FAQ_ITEMS: FaqItem[] = [
  {
    key: "checkin",
    label: "No puedo hacer check-in",
    icon: "location-outline",
    content: [
      "Verifica que tengas internet estable y vuelve a actualizar la ubicación desde Home.",
      "Confirma que estás dentro del radio permitido de la sede y con precisión GPS suficiente.",
      "Si sigue fallando, crea un ticket con captura del mensaje y hora del intento.",
    ],
  },
  {
    key: "site",
    label: "Cómo actualizar mi sede",
    icon: "business-outline",
    content: [
      "La sede principal la gestiona un gerente, gerente general o propietario desde Equipo.",
      "Si trabajas en varias sedes, selecciona la sede correcta antes del check-in.",
      "Después del cambio, refresca Home para recargar permisos y geocerca.",
    ],
  },
  {
    key: "gps",
    label: "Error en la ubicación GPS",
    icon: "navigate-outline",
    content: [
      "Activa GPS de alta precisión y evita registrar asistencia en interiores sin señal.",
      "Desactiva apps de ubicación simulada o modo desarrollador con mock location.",
      "Si Android no muestra el permiso en app, ve a Ajustes del sistema y habilítalo manualmente.",
    ],
  },
  {
    key: "android-permissions",
    label: "Cómo activar permisos en Android",
    icon: "phone-portrait-outline",
    content: [
      "En Configuración > Permisos de ANIMA, habilita Ubicación y Notificaciones.",
      "Si el permiso aparece bloqueado, usa el botón Abrir ajustes en Configuración de ANIMA.",
      "Vuelve a la app y entra a Home para que el estado de permisos se refresque.",
    ],
  },
  {
    key: "break",
    label: "Cómo usar descanso de turno",
    icon: "cafe-outline",
    content: [
      "Con turno activo verás el botón Tomar descanso debajo del registro de entrada/salida.",
      "Mientras estás en descanso, el contador neto no aumenta.",
      "Al finalizar descanso o cerrar turno, el tiempo neto se calcula descontando la pausa.",
    ],
  },
  {
    key: "export-role",
    label: "Cómo exportar asistencia por rol",
    icon: "download-outline",
    content: [
      "Trabajadores y roles no gerenciales exportan solo su registro personal.",
      "Gerentes exportan asistencia global de su sede seleccionada.",
      "Propietario y gerente general pueden exportar global o por trabajador individual.",
    ],
  },
];

function normalizeTicket(
  raw: any,
): TicketRow {
  const siteRelation = Array.isArray(raw.sites) ? raw.sites[0] : raw.sites;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    status: raw.status as TicketStatus,
    category: raw.category,
    site_id: raw.site_id ?? null,
    created_by: raw.created_by,
    assigned_to: raw.assigned_to ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    siteName: siteRelation?.name ?? null,
  };
}

function statusMeta(status: TicketStatus) {
  if (status === "open") {
    return { label: "Abierto", color: COLORS.accent, bg: "rgba(226, 0, 106, 0.10)" };
  }
  if (status === "in_progress") {
    return { label: "En progreso", color: "#B45309", bg: "#FFFBEB" };
  }
  if (status === "resolved") {
    return { label: "Resuelto", color: "#0F766E", bg: "#ECFEFF" };
  }
  return { label: "Cerrado", color: COLORS.neutral, bg: COLORS.porcelainAlt };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, selectedSiteId } = useAuth();

  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const loadTickets = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, title, description, status, category, site_id, created_by, assigned_to, created_at, updated_at, sites(name)",
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const normalized = ((data as any[]) ?? []).map(normalizeTicket);
      setTickets(normalized);
      setSelectedTicketId((prev) => {
        if (prev && normalized.some((item) => item.id === prev)) return prev;
        return normalized[0]?.id ?? null;
      });
    } catch (err) {
      console.error("[SUPPORT] Tickets load error:", err);
      Alert.alert("Soporte", "No se pudieron cargar los tickets.");
    } finally {
      setIsLoadingTickets(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (ticketId: string | null) => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, ticket_id, author_id, body, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data as MessageRow[]) ?? []);
    } catch (err) {
      console.error("[SUPPORT] Messages load error:", err);
      Alert.alert("Soporte", "No se pudieron cargar los mensajes del ticket.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadTickets(),
      loadMessages(selectedTicketId),
    ]);
    setIsRefreshing(false);
  };

  const submitTicket = async () => {
    if (!user?.id) return;
    if (!ticketTitle.trim()) {
      Alert.alert("Soporte", "Escribe un asunto para el ticket.");
      return;
    }
    if (!ticketMessage.trim()) {
      Alert.alert("Soporte", "Escribe el detalle antes de enviar.");
      return;
    }

    setIsCreatingTicket(true);
    try {
      const siteId = employee?.siteId ?? selectedSiteId ?? null;
      const { data: ticketRow, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          created_by: user.id,
          site_id: siteId,
          category: "attendance",
          title: ticketTitle.trim(),
          description: ticketMessage.trim(),
          status: "open",
        })
        .select("id")
        .single();

      if (ticketError || !ticketRow?.id) throw ticketError ?? new Error("Ticket creation failed");

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticketRow.id,
          author_id: user.id,
          body: ticketMessage.trim(),
        });
      if (messageError) throw messageError;

      setTicketTitle("");
      setTicketMessage("");
      setIsTicketOpen(false);
      await loadTickets();
      setSelectedTicketId(ticketRow.id);
      await loadMessages(ticketRow.id);
      Alert.alert("Soporte", "Ticket creado y chat habilitado.");
    } catch (err) {
      console.error("[SUPPORT] Ticket create error:", err);
      Alert.alert("Soporte", "No se pudo crear el ticket.");
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const sendMessage = async () => {
    if (!user?.id || !selectedTicketId) return;
    const body = newMessage.trim();
    if (!body) return;

    setIsSendingMessage(true);
    try {
      const { error: insertError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicketId,
          author_id: user.id,
          body,
        });
      if (insertError) throw insertError;

      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicketId);

      setNewMessage("");
      await Promise.all([loadMessages(selectedTicketId), loadTickets()]);
    } catch (err) {
      console.error("[SUPPORT] Send message error:", err);
      Alert.alert("Soporte", "No se pudo enviar el mensaje.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [loadTickets]),
  );

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedTicketId);
  }, [selectedTicketId, loadMessages]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`support-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          void loadTickets();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        (payload) => {
          const ticketId =
            ((payload.new as any)?.ticket_id as string | undefined) ??
            ((payload.old as any)?.ticket_id as string | undefined) ??
            null;
          if (ticketId && ticketId === selectedTicketId) {
            void loadMessages(ticketId);
          }
          void loadTickets();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, selectedTicketId, loadMessages, loadTickets]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>Soporte</Text>
        <Text style={styles.subtitle}>
          Chat interno por tickets para atender novedades operativas.
        </Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Canales rápidos</Text>
            <Text style={styles.cardSubtitle}>
              Crea ticket y conversa con soporte en el hilo interno.
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setIsTicketOpen(true)}
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor: COLORS.accent,
                    backgroundColor: "rgba(226, 0, 106, 0.12)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                  },
                ]}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                  Crear ticket
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 12,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>
                  Chat activo
                </Text>
              </View>
            </View>
          </View>

          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Tickets</Text>
            <Text style={styles.cardSubtitle}>
              Selecciona un ticket para abrir el chat interno.
            </Text>

            {isLoadingTickets ? (
              <View style={{ marginTop: 14, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : null}

            {!isLoadingTickets && tickets.length === 0 ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  padding: 12,
                }}
              >
                <Text style={{ color: COLORS.neutral, fontSize: 12 }}>
                  No tienes tickets abiertos. Crea uno para iniciar el chat.
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 12, gap: 10 }}>
              {tickets.map((ticket) => {
                const status = statusMeta(ticket.status);
                const active = selectedTicketId === ticket.id;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => setSelectedTicketId(ticket.id)}
                    style={[
                      UI.row,
                      {
                        borderColor: active ? COLORS.accent : COLORS.border,
                        backgroundColor: active
                          ? "rgba(226, 0, 106, 0.06)"
                          : COLORS.white,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontWeight: "800", color: COLORS.text }}>
                        {ticket.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: COLORS.neutral,
                          marginTop: 4,
                        }}
                      >
                        {ticket.siteName ?? "Sin sede"} ·{" "}
                        {formatDateTime(ticket.updated_at)}
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        backgroundColor: status.bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedTicket ? (
            <View style={[UI.card, { padding: 14 }]}>
              <Text style={styles.cardTitle}>Chat interno</Text>
              <Text style={styles.cardSubtitle}>
                Ticket: {selectedTicket.title}
              </Text>

              {isLoadingMessages ? (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : (
                <View
                  style={{
                    marginTop: 12,
                    gap: 8,
                    maxHeight: 300,
                  }}
                >
                  {messages.length === 0 ? (
                    <Text style={{ color: COLORS.neutral, fontSize: 12 }}>
                      Aún no hay mensajes en este ticket.
                    </Text>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.author_id === user?.id;
                      return (
                        <View
                          key={message.id}
                          style={{
                            alignSelf: isOwn ? "flex-end" : "flex-start",
                            maxWidth: "85%",
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isOwn ? COLORS.accent : COLORS.border,
                            backgroundColor: isOwn
                              ? "rgba(226, 0, 106, 0.10)"
                              : COLORS.porcelainAlt,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ color: COLORS.text, fontSize: 13 }}>
                            {message.body}
                          </Text>
                          <Text
                            style={{
                              marginTop: 4,
                              color: COLORS.neutral,
                              fontSize: 10,
                            }}
                          >
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
                  onChangeText={setNewMessage}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor={COLORS.neutral}
                  style={styles.messageInput}
                />
                <TouchableOpacity
                  onPress={sendMessage}
                  disabled={isSendingMessage || !newMessage.trim()}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.accent,
                      backgroundColor: "rgba(226, 0, 106, 0.12)",
                      justifyContent: "center",
                      opacity:
                        isSendingMessage || !newMessage.trim() ? 0.6 : 1,
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

          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Preguntas frecuentes</Text>
            <Text style={styles.cardSubtitle}>Guías rápidas para resolver dudas comunes.</Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {FAQ_ITEMS.map((item) => {
                const open = openFaqKey === item.key;
                return (
                  <View
                    key={item.key}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: open ? COLORS.accent : COLORS.border,
                      backgroundColor: open
                        ? "rgba(226, 0, 106, 0.06)"
                        : COLORS.white,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setOpenFaqKey(open ? null : item.key)}
                      style={[UI.row, { borderWidth: 0, backgroundColor: "transparent" }]}
                      activeOpacity={0.85}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <Ionicons name={item.icon} size={18} color={COLORS.text} />
                        <Text
                          style={{ fontWeight: "800", color: COLORS.text, flex: 1 }}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <Ionicons
                        name={open ? "chevron-up" : "chevron-forward"}
                        size={18}
                        color={COLORS.neutral}
                      />
                    </TouchableOpacity>

                    {open ? (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                        {item.content.map((paragraph, index) => (
                          <Text
                            key={`${item.key}-${index}`}
                            style={{
                              fontSize: 12,
                              color: COLORS.neutral,
                              lineHeight: 18,
                              marginTop: index === 0 ? 0 : 8,
                            }}
                          >
                            {paragraph}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <SupportTicketModal
        visible={isTicketOpen}
        title={ticketTitle}
        message={ticketMessage}
        isSubmitting={isCreatingTicket}
        onChangeTitle={setTicketTitle}
        onChangeMessage={setTicketMessage}
        onClose={() => setIsTicketOpen(false)}
        onSubmit={submitTicket}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.neutral,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
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
});
