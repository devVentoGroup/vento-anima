import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import type { WorkerOption } from "@/components/support/ContactWorkerModal";
import type { MessageRow, TicketRow, TicketStatus } from "@/components/support/types";

function normalizeTicket(raw: any): TicketRow {
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

type UseSupportDataArgs = {
  userId: string | undefined;
  canContactWorker: boolean;
  role: string | null;
  managerSiteId: string | null;
  contactModalVisible: boolean;
};

export function useSupportData({
  userId,
  canContactWorker,
  role,
  managerSiteId,
  contactModalVisible,
}: UseSupportDataArgs) {
  const [workersForContact, setWorkersForContact] = useState<WorkerOption[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const loadWorkersForContact = useCallback(async () => {
    if (!userId || !canContactWorker) return;
    if (role === "gerente" && !managerSiteId) {
      setWorkersForContact([]);
      return;
    }

    setIsLoadingWorkers(true);
    try {
      let query = supabase
        .from("employees")
        .select("id, full_name, alias")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (role === "gerente" && managerSiteId) {
        query = query.eq("site_id", managerSiteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkersForContact((data as WorkerOption[]) ?? []);
    } catch (err) {
      console.error("[SUPPORT] Workers load error:", err);
      Alert.alert("Soporte", "No se pudieron cargar los trabajadores.");
      setWorkersForContact([]);
    } finally {
      setIsLoadingWorkers(false);
    }
  }, [canContactWorker, managerSiteId, role, userId]);

  const loadTickets = useCallback(async () => {
    if (!userId) return;

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
  }, [userId]);

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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadTickets(), loadMessages(selectedTicketId)]);
    setIsRefreshing(false);
  }, [loadMessages, loadTickets, selectedTicketId]);

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
    if (contactModalVisible && canContactWorker) {
      void loadWorkersForContact();
    }
  }, [canContactWorker, contactModalVisible, loadWorkersForContact]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`support-live-${userId}`)
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
  }, [loadMessages, loadTickets, selectedTicketId, userId]);

  return {
    workersForContact,
    isLoadingWorkers,
    tickets,
    isLoadingTickets,
    isRefreshing,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    messages,
    isLoadingMessages,
    loadWorkersForContact,
    loadTickets,
    loadMessages,
    handleRefresh,
  };
}
