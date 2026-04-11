import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import type {
  AttendanceBreak,
  AttendanceLog,
  DerivedLog,
} from "@/components/history/types";

export type RangeMode = "week" | "month";

function overlapMinutes(
  intervalStartMs: number,
  intervalEndMs: number,
  breaks: AttendanceBreak[],
) {
  if (intervalEndMs <= intervalStartMs) return 0;
  let total = 0;

  breaks.forEach((item) => {
    const breakStart = new Date(item.started_at).getTime();
    const breakEnd = new Date(item.ended_at ?? new Date().toISOString()).getTime();
    if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd)) return;

    const start = Math.max(intervalStartMs, breakStart);
    const end = Math.min(intervalEndMs, breakEnd);
    if (end > start) {
      total += (end - start) / 60000;
    }
  });

  return total;
}

function getRange(anchor: Date, mode: RangeMode) {
  const start = new Date(anchor);
  const end = new Date(anchor);

  if (mode === "week") {
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatRangeLabel(start: Date, end: Date) {
  const left = start.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
  const right = end.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${left} - ${right}`;
}

type UseHistoryDataArgs = {
  userId: string | undefined;
};

export function useHistoryData({ userId }: UseHistoryDataArgs) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [rangeAnchor, setRangeAnchor] = useState(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  });
  const [rows, setRows] = useState<DerivedLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const range = useMemo(
    () => getRange(rangeAnchor, rangeMode),
    [rangeAnchor, rangeMode],
  );
  const rangeLabel = useMemo(
    () => formatRangeLabel(range.start, range.end),
    [range.start, range.end],
  );

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const startIso = range.start.toISOString();
      const endIso = range.end.toISOString();

      const [{ data: logsData, error: logsError }, { data: breaksData, error: breaksError }] =
        await Promise.all([
          supabase
            .from("attendance_logs")
            .select(
              "id, action, occurred_at, site_id, latitude, longitude, accuracy_meters, notes, sites(name)",
            )
            .eq("employee_id", userId)
            .gte("occurred_at", startIso)
            .lte("occurred_at", endIso)
            .order("occurred_at", { ascending: true }),
          supabase
            .from("attendance_breaks")
            .select("started_at, ended_at")
            .eq("employee_id", userId)
            .lte("started_at", endIso)
            .or(`ended_at.is.null,ended_at.gte.${startIso}`)
            .order("started_at", { ascending: true }),
        ]);

      if (logsError) throw logsError;
      if (breaksError) throw breaksError;

      const logs = (logsData ?? []) as AttendanceLog[];
      const breaks = (breaksData ?? []) as AttendanceBreak[];
      const derived: DerivedLog[] = [];
      let pendingIndex: number | null = null;

      logs.forEach((log) => {
        const dayKey = log.occurred_at.slice(0, 10);
        if (log.action === "check_in") {
          if (pendingIndex != null) {
            derived[pendingIndex] = {
              ...derived[pendingIndex],
              statusLabel: "Sin salida",
              durationMinutes: null,
              breakMinutes: null,
            };
          }
          const index = derived.length;
          derived.push({
            ...log,
            dayKey,
            statusLabel: "En curso",
            durationMinutes: null,
            breakMinutes: null,
          });
          pendingIndex = index;
          return;
        }

        if (pendingIndex != null) {
          const pending = derived[pendingIndex];
          const start = new Date(pending.occurred_at).getTime();
          const end = new Date(log.occurred_at).getTime();
          const grossMinutes = (end - start) / 60000;
          const breakMinutes = overlapMinutes(start, end, breaks);
          const netMinutes = Math.max(0, grossMinutes - breakMinutes);

          derived[pendingIndex] = {
            ...pending,
            statusLabel: "Salida registrada",
            durationMinutes: netMinutes,
            breakMinutes,
          };

          derived.push({
            ...log,
            dayKey,
            statusLabel: "Turno cerrado",
            durationMinutes: netMinutes,
            breakMinutes,
          });

          pendingIndex = null;
          return;
        }

        derived.push({
          ...log,
          dayKey,
          statusLabel: "Sin entrada",
          durationMinutes: null,
          breakMinutes: null,
        });
      });

      if (pendingIndex != null) {
        const pending = derived[pendingIndex];
        const start = new Date(pending.occurred_at).getTime();
        const now = Date.now();
        const grossMinutes = (now - start) / 60000;
        const breakMinutes = overlapMinutes(start, now, breaks);
        const netMinutes = Math.max(0, grossMinutes - breakMinutes);
        derived[pendingIndex] = {
          ...pending,
          statusLabel: "En curso",
          durationMinutes: netMinutes,
          breakMinutes,
        };
      }

      setRows(derived.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)));
    } catch (err) {
      console.error("History error:", err);
      Alert.alert("Error", "No se pudo cargar el historial.");
    } finally {
      setIsLoading(false);
    }
  }, [range.end, range.start, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  }, [loadHistory]);

  const shiftRange = useCallback(
    (direction: "prev" | "next") => {
      setRangeAnchor((prev) => {
        const next = new Date(prev);
        if (rangeMode === "week") {
          next.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
        } else {
          next.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
        }
        return next;
      });
    },
    [rangeMode],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, DerivedLog[]>();
    rows.forEach((row) => {
      const list = map.get(row.dayKey) ?? [];
      list.push(row);
      map.set(row.dayKey, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [rows]);

  return {
    rangeMode,
    setRangeMode,
    rows,
    setRows,
    isLoading,
    isRefreshing,
    rangeLabel,
    grouped,
    handleRefresh,
    shiftRange,
  };
}
