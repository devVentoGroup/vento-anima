import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import type { DerivedLog } from "@/components/history/types";

type UseHistoryInteractionsArgs = {
  setRows: React.Dispatch<React.SetStateAction<DerivedLog[]>>;
};

export function useHistoryInteractions({
  setRows,
}: UseHistoryInteractionsArgs) {
  const [selectedLog, setSelectedLog] = useState<DerivedLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [isSavingIncident, setIsSavingIncident] = useState(false);

  const openDetails = useCallback((log: DerivedLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  }, []);

  const openIncident = useCallback((log: DerivedLog) => {
    setSelectedLog(log);
    setIncidentText(log.notes ?? "");
    setIsIncidentOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const closeIncident = useCallback(() => {
    setIsIncidentOpen(false);
  }, []);

  const saveIncident = useCallback(async () => {
    if (!selectedLog) return;
    setIsSavingIncident(true);
    try {
      const nextNotes = incidentText.trim() || null;
      const { error } = await supabase
        .from("attendance_logs")
        .update({ notes: nextNotes })
        .eq("id", selectedLog.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((item) =>
          item.id === selectedLog.id ? { ...item, notes: nextNotes } : item,
        ),
      );
      setIsIncidentOpen(false);
    } catch (err) {
      console.error("Incident error:", err);
      Alert.alert("Error", "No se pudo guardar la incidencia.");
    } finally {
      setIsSavingIncident(false);
    }
  }, [incidentText, selectedLog, setRows]);

  return {
    selectedLog,
    isDetailOpen,
    isIncidentOpen,
    incidentText,
    setIncidentText,
    isSavingIncident,
    openDetails,
    openIncident,
    closeDetails,
    closeIncident,
    saveIncident,
  };
}
