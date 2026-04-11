import type { ValidatedLocation } from "@/lib/geolocation";
import type { GeofenceCheckState, GeofenceMode } from "@/hooks/attendance/shared";
import { buildGeofenceBlockedState } from "@/hooks/attendance/geofence-state";

type EmployeeSiteLike = {
  siteId: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};

type LastAttendanceLog = {
  action: "check_in" | "check_out";
  site_id: string;
} | null;

type UpdateSource = "auto" | "user" | "check_action";

type ResolveGeofenceTargetArgs = {
  argsMode?: GeofenceMode;
  argsSiteId?: string | null;
  selectedSiteId?: string | null;
  employeeSites: EmployeeSiteLike[];
  lastLog: LastAttendanceLog;
  now: number;
  updateSource: UpdateSource;
  location: ValidatedLocation | null;
  checkInMaxAccuracyMeters: number;
  checkOutMaxAccuracyMeters: number;
  resolveBestEffortSelectionLocation: (
    location: ValidatedLocation | null,
  ) => Promise<ValidatedLocation | null>;
  buildSelectionCandidates: (
    employeeSites: EmployeeSiteLike[],
    baseLocation: ValidatedLocation | null,
  ) => Array<{
    id: string;
    name: string;
    distanceMeters: number | null;
    effectiveRadiusMeters: number;
    requiresGeolocation: boolean;
  }>;
  buildDeviceInfoPayload: (
    location: ValidatedLocation | null,
    extra?: Record<string, unknown>,
  ) => Record<string, unknown> | null;
};

export async function resolveGeofenceTarget({
  argsMode,
  argsSiteId,
  selectedSiteId,
  employeeSites,
  lastLog,
  now,
  updateSource,
  location,
  checkInMaxAccuracyMeters,
  checkOutMaxAccuracyMeters,
  resolveBestEffortSelectionLocation,
  buildSelectionCandidates,
  buildDeviceInfoPayload,
}: ResolveGeofenceTargetArgs):
  Promise<
    | {
        kind: "resolved";
        mode: GeofenceMode;
        siteId: string;
        policy: { maxAccuracyMeters: number };
        location: ValidatedLocation | null;
      }
    | {
        kind: "blocked";
        state: GeofenceCheckState;
      }
  > {
  const mode =
    argsMode ?? (lastLog?.action === "check_in" ? "check_out" : "check_in");
  const maxAccuracyMeters =
    mode === "check_out"
      ? checkOutMaxAccuracyMeters
      : checkInMaxAccuracyMeters;
  const policy = { maxAccuracyMeters };

  const assignedGeoSites = employeeSites.filter(
    (item) => item.latitude != null && item.longitude != null,
  );
  const assignedNonGeoSites = employeeSites.filter(
    (item) => item.latitude == null || item.longitude == null,
  );

  const selectedSiteIsValid =
    selectedSiteId != null &&
    employeeSites.some((item) => item.siteId === selectedSiteId);
  const effectiveSelectedSiteId = selectedSiteIsValid ? selectedSiteId : null;

  let siteId: string | null = null;

  if (mode === "check_out") {
    siteId = argsSiteId ?? lastLog?.site_id ?? null;
  } else {
    if (argsSiteId) {
      siteId = argsSiteId;
    } else if (employeeSites.length > 1) {
      if (effectiveSelectedSiteId) {
        siteId = effectiveSelectedSiteId;
      } else {
        const selectionLocation =
          await resolveBestEffortSelectionLocation(location);
        return {
          kind: "blocked",
          state: buildGeofenceBlockedState({
            mode,
            lastUpdateSource: updateSource,
            message: "Selecciona una sede para continuar",
            updatedAt: now,
            location: selectionLocation ?? null,
            deviceInfo: buildDeviceInfoPayload(selectionLocation ?? null),
            requiresSelection: true,
            candidateSites: buildSelectionCandidates(
              employeeSites,
              selectionLocation ?? null,
            ),
            accuracyMeters: selectionLocation?.accuracy ?? null,
          }),
        };
      }
    } else if (employeeSites.length === 1) {
      siteId = employeeSites[0].siteId;
    } else if (assignedGeoSites.length === 1) {
      siteId = assignedGeoSites[0].siteId;
    } else if (assignedNonGeoSites.length === 1) {
      siteId = assignedNonGeoSites[0].siteId;
    }
  }

  if (!siteId) {
    return {
      kind: "blocked",
      state: buildGeofenceBlockedState({
        mode,
        lastUpdateSource: updateSource,
        message: "No tienes sede asignada",
        updatedAt: now,
      }),
    };
  }

  return {
    kind: "resolved",
    mode,
    siteId,
    policy,
    location,
  };
}
