import type { MutableRefObject } from "react";

import type {
  GeofenceCheckState,
  GeofenceLatchState,
  GeofenceMode,
} from "@/hooks/attendance/shared";

type UpdateSource = "auto" | "user" | "check_action";
type LatchReason = "network" | "location";

export function setLatchFromGeofenceSuccess(
  latchRef: MutableRefObject<GeofenceLatchState | null>,
  state: GeofenceCheckState,
  ttlCheckInMs: number,
  ttlCheckOutMs: number,
): void {
  if (!state.canProceed || state.status !== "ready" || !state.siteId || !state.updatedAt) return;
  if (state.distanceMeters == null || state.accuracyMeters == null) return;

  const ttlMs = state.mode === "check_in" ? ttlCheckInMs : ttlCheckOutMs;
  latchRef.current = {
    siteId: state.siteId,
    grantedAt: new Date(state.updatedAt).toISOString(),
    expiresAt: new Date(state.updatedAt + ttlMs).toISOString(),
    distanceMeters: state.distanceMeters,
    accuracy: state.accuracyMeters,
  };
}

export function clearExpiredGeofenceLatch(
  latchRef: MutableRefObject<GeofenceLatchState | null>,
): void {
  const current = latchRef.current;
  if (!current) return;
  if (Date.parse(current.expiresAt) > Date.now()) return;
  latchRef.current = null;
}

export function isGeofenceLatchValidFor(
  latchRef: MutableRefObject<GeofenceLatchState | null>,
  siteId?: string | null,
): boolean {
  clearExpiredGeofenceLatch(latchRef);
  const current = latchRef.current;
  if (!current) return false;
  if (siteId && current.siteId !== siteId) return false;
  return Date.parse(current.expiresAt) > Date.now();
}

export function canReuseRecentReadyGeofenceState(
  cacheRef: MutableRefObject<GeofenceCheckState | null>,
  mode: GeofenceMode,
  ttlCheckInMs: number,
  ttlCheckOutMs: number,
  siteId?: string | null,
  maxAgeMs?: number,
): GeofenceCheckState | null {
  const latchTtlMs = mode === "check_in" ? ttlCheckInMs : ttlCheckOutMs;
  const effectiveMaxAgeMs = maxAgeMs ?? latchTtlMs;
  const cached = cacheRef.current;
  if (!cached) return null;
  if (cached.status !== "ready" || !cached.canProceed) return null;
  if (cached.mode !== mode) return null;
  if (!cached.updatedAt || Date.now() - cached.updatedAt > effectiveMaxAgeMs) return null;
  if (siteId && cached.siteId !== siteId) return null;
  return cached;
}

export function buildLatchedReadyGeofenceState(
  cachedReady: GeofenceCheckState,
  source: UpdateSource,
  reason: LatchReason,
  ttlCheckInMs: number,
  ttlCheckOutMs: number,
): GeofenceCheckState {
  const ageMs = Date.now() - (cachedReady.updatedAt ?? Date.now());
  const maxMs =
    cachedReady.mode === "check_in" ? ttlCheckInMs : ttlCheckOutMs;
  const remainingMs = Math.max(0, maxMs - ageMs);
  const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
  const reasonText =
    reason === "network" ? "sin conexión estable" : "con GPS inestable";

  return {
    ...cachedReady,
    lastUpdateSource: source,
    isLatchedReady: true,
    latchedReason: reason,
    latchExpiresAt: (cachedReady.updatedAt ?? Date.now()) + maxMs,
    message: `Ubicación verificada recientemente (${reasonText}). Puedes registrar por ${remainingMin} min.`,
  };
}
