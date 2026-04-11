import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import type { WorkerOption } from "@/components/support/ContactWorkerModal";

type UseSupportActionsArgs = {
  userId: string | undefined;
  employeeSiteId: string | null | undefined;
  selectedSiteId: string | null;
  selectedTicketId: string | null;
  loadTickets: () => Promise<void>;
  loadMessages: (ticketId: string | null) => Promise<void>;
  setSelectedTicketId: (ticketId: string | null) => void;
};

export function useSupportActions({
  userId,
  employeeSiteId,
  selectedSiteId,
  selectedTicketId,
  loadTickets,
  loadMessages,
  setSelectedTicketId,
}: UseSupportActionsArgs) {
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [contactMode, setContactMode] = useState<"aviso" | "conversacion">("aviso");
  const [selectedWorker, setSelectedWorker] = useState<WorkerOption | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const submitTicket = useCallback(async () => {
    if (!userId) return;
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
      const siteId = employeeSiteId ?? selectedSiteId ?? null;
      const { data: ticketRow, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          created_by: userId,
          site_id: siteId,
          category: "attendance",
          title: ticketTitle.trim(),
          description: ticketMessage.trim(),
          status: "open",
        })
        .select("id")
        .single();

      if (ticketError || !ticketRow?.id) {
        throw ticketError ?? new Error("Ticket creation failed");
      }

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticketRow.id,
          author_id: userId,
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
  }, [
    employeeSiteId,
    loadMessages,
    loadTickets,
    selectedSiteId,
    setSelectedTicketId,
    ticketMessage,
    ticketTitle,
    userId,
  ]);

  const sendMessage = useCallback(async () => {
    if (!userId || !selectedTicketId) return;
    const body = newMessage.trim();
    if (!body) return;

    setIsSendingMessage(true);
    try {
      const { error: insertError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicketId,
          author_id: userId,
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
  }, [loadMessages, loadTickets, newMessage, selectedTicketId, userId]);

  const submitContactWorker = useCallback(async () => {
    if (!userId || !selectedWorker) return;
    if (contactMode === "aviso" && !contactMessage.trim()) {
      Alert.alert("Soporte", "Escribe el aviso antes de enviar.");
      return;
    }

    const displayName =
      selectedWorker.full_name ?? selectedWorker.alias ?? selectedWorker.id;
    const title =
      contactMode === "aviso"
        ? `Aviso para ${displayName}`
        : `Conversación con ${displayName}`;
    const body =
      contactMessage.trim() ||
      (contactMode === "conversacion" ? "(Conversación iniciada)" : "");

    setIsSubmittingContact(true);
    try {
      const siteId = employeeSiteId ?? selectedSiteId ?? null;
      const { data: ticketRow, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          created_by: userId,
          site_id: siteId,
          target_employee_id: selectedWorker.id,
          category: "attendance",
          title,
          description: body,
          status: "open",
        })
        .select("id")
        .single();

      if (ticketError || !ticketRow?.id) {
        throw ticketError ?? new Error("Ticket creation failed");
      }

      if (body) {
        const { error: messageError } = await supabase
          .from("support_messages")
          .insert({
            ticket_id: ticketRow.id,
            author_id: userId,
            body,
          });
        if (messageError) throw messageError;
      }

      setSelectedWorker(null);
      setContactMessage("");
      setContactModalVisible(false);
      await loadTickets();
      setSelectedTicketId(ticketRow.id);
      await loadMessages(ticketRow.id);
      Alert.alert(
        "Soporte",
        contactMode === "aviso"
          ? "Aviso enviado. El trabajador lo verá en Soporte."
          : "Conversación iniciada. El trabajador la verá en Soporte.",
      );
    } catch (err) {
      console.error("[SUPPORT] Contact worker ticket error:", err);
      Alert.alert("Soporte", "No se pudo crear el ticket.");
    } finally {
      setIsSubmittingContact(false);
    }
  }, [
    contactMessage,
    contactMode,
    employeeSiteId,
    loadMessages,
    loadTickets,
    selectedSiteId,
    selectedWorker,
    setSelectedTicketId,
    userId,
  ]);

  return {
    isTicketOpen,
    setIsTicketOpen,
    ticketTitle,
    setTicketTitle,
    ticketMessage,
    setTicketMessage,
    isCreatingTicket,
    contactModalVisible,
    setContactModalVisible,
    contactMode,
    setContactMode,
    selectedWorker,
    setSelectedWorker,
    contactMessage,
    setContactMessage,
    isSubmittingContact,
    newMessage,
    setNewMessage,
    isSendingMessage,
    submitTicket,
    sendMessage,
    submitContactWorker,
  };
}
