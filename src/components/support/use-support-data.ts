import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const SUPPORT_CACHE_MS = 4000;
  const [workersForContact, setWorkersForContact] = useState<WorkerOption[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const loadWorkersInFlightRef = useRef<Promise<void> | null>(null);
  const loadTicketsInFlightRef = useRef<Promise<void> | null>(null);
  const loadMessagesInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const lastWorkersLoadedAtRef = useRef(0);
  const lastTicketsLoadedAtRef = useRef(0);
  const lastMessagesLoadedAtRef = useRef<Map<string, number>>(new Map());

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
    if (loadWorkersInFlightRef.current) {
      await loadWorkersInFlightRef.current;
      return;
    }
    if (Date.now() - lastWorkersLoadedAtRef.current < SUPPORT_CACHE_MS) return;

    const task = (async () => {
      try {
        setIsLoadingWorkers(true);
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
    })();

    loadWorkersInFlightRef.current = task;
    try {
      await task;
      lastWorkersLoadedAtRef.current = Date.now();
    } finally {
      loadWorkersInFlightRef.current = null;
    }
  }, [canContactWorker, managerSiteId, role, userId]);

  const loadTickets = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) return;
    if (loadTicketsInFlightRef.current) {
      await loadTicketsInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastTicketsLoadedAtRef.current < SUPPORT_CACHE_MS) return;

    const task = (async () => {
      try {
        setIsLoadingTickets(true);
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
    })();

    loadTicketsInFlightRef.current = task;
    try {
      await task;
      lastTicketsLoadedAtRef.current = Date.now();
    } finally {
      loadTicketsInFlightRef.current = null;
    }
  }, [userId]);

  const loadMessages = useCallback(async (ticketId: string | null, opts?: { force?: boolean }) => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    const currentInFlight = loadMessagesInFlightRef.current.get(ticketId);
    if (currentInFlight) {
      await currentInFlight;
      return;
    }
    const lastLoadedAt = lastMessagesLoadedAtRef.current.get(ticketId) ?? 0;
    if (!opts?.force && Date.now() - lastLoadedAt < SUPPORT_CACHE_MS) return;

    const task = (async () => {
      try {
        setIsLoadingMessages(true);
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
    })();

    loadMessagesInFlightRef.current.set(ticketId, task);
    try {
      await task;
      lastMessagesLoadedAtRef.current.set(ticketId, Date.now());
    } finally {
      loadMessagesInFlightRef.current.delete(ticketId);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    lastTicketsLoadedAtRef.current = 0;
    if (selectedTicketId) {
      lastMessagesLoadedAtRef.current.delete(selectedTicketId);
    }
    await Promise.all([loadTickets({ force: true }), loadMessages(selectedTicketId, { force: true })]);
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
          lastTicketsLoadedAtRef.current = 0;
          void loadTickets({ force: true });
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
            lastMessagesLoadedAtRef.current.delete(ticketId);
            void loadMessages(ticketId, { force: true });
          }
          lastTicketsLoadedAtRef.current = 0;
          void loadTickets({ force: true });
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
