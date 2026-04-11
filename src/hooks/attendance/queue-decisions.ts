import type {
  AttendanceBreakRow,
  PendingAttendanceEvent,
  PendingBreakEvent,
  QueueSyncDecision,
} from "@/hooks/attendance/shared";

type LastAttendanceLog = {
  action: "check_in" | "check_out";
  occurred_at: string;
  site_id: string;
} | null;

export function evaluateBreakQueueSyncDecision(
  item: PendingBreakEvent,
  last: LastAttendanceLog,
  openBreak: AttendanceBreakRow | null,
): QueueSyncDecision {
  if (item.payload.action === "start") {
    if (!last || last.action !== "check_in") {
      return {
        kind: "conflict",
        reason: "Conflicto de secuencia: no hay turno activo para iniciar descanso.",
      };
    }
    if (openBreak) {
      return { kind: "drop", reason: "Descanso ya activo (evento duplicado)." };
    }
    return { kind: "proceed" };
  }

  if (!openBreak) {
    return { kind: "drop", reason: "No hay descanso activo (cierre duplicado)." };
  }

  return { kind: "proceed" };
}

export function evaluateAttendanceQueueSyncDecision(
  item: PendingAttendanceEvent,
  last: LastAttendanceLog,
): QueueSyncDecision {
  if (!last) {
    if (item.payload.action === "check_in") return { kind: "proceed" };
    return {
      kind: "conflict",
      reason: "Conflicto de secuencia: no hay check-in activo para este check-out.",
    };
  }

  if (item.payload.action === "check_in") {
    if (last.action === "check_in") {
      if (last.site_id === item.payload.site_id) {
        return { kind: "drop", reason: "Check-in ya activo (evento duplicado)." };
      }
      return {
        kind: "conflict",
        reason: "Conflicto de secuencia: ya existe un check-in activo en otra sede.",
      };
    }
    return { kind: "proceed" };
  }

  if (last.action === "check_out") {
    return { kind: "drop", reason: "Turno ya cerrado (check-out duplicado)." };
  }
  if (last.site_id !== item.payload.site_id) {
    return {
      kind: "conflict",
      reason: "Conflicto de sede: check-out pendiente no coincide con sede activa.",
    };
  }
  return { kind: "proceed" };
}
