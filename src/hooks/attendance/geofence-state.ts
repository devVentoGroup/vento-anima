import type { ValidatedLocation } from "@/lib/geolocation";
import type { GeofenceCheckState, GeofenceMode, SiteCandidate } from "@/hooks/attendance/shared";

type UpdateSource = "auto" | "user" | "check_action";

type BaseArgs = {
  mode: GeofenceMode;
  updatedAt: number;
  siteId?: string | null;
  siteName?: string | null;
  distanceMeters?: number | null;
  accuracyMeters?: number | null;
  effectiveRadiusMeters?: number | null;
  message: string;
  location?: ValidatedLocation | null;
  deviceInfo?: Record<string, unknown> | null;
  requiresSelection?: boolean;
  candidateSites?: SiteCandidate[] | null;
  lastUpdateSource?: UpdateSource;
};

export function buildGeofenceBlockedState({
  mode,
  updatedAt,
  siteId = null,
  siteName = null,
  distanceMeters = null,
  accuracyMeters = null,
  effectiveRadiusMeters = null,
  message,
  location = null,
  deviceInfo = null,
  requiresSelection = false,
  candidateSites = null,
  lastUpdateSource,
}: BaseArgs): GeofenceCheckState {
  return {
    status: "blocked",
    canProceed: false,
    mode,
    lastUpdateSource,
    siteId,
    siteName,
    distanceMeters,
    accuracyMeters,
    effectiveRadiusMeters,
    message,
    updatedAt,
    location,
    deviceInfo,
    requiresSelection,
    candidateSites,
  };
}

export function buildGeofenceErrorState({
  mode,
  updatedAt,
  siteId = null,
  siteName = null,
  distanceMeters = null,
  accuracyMeters = null,
  effectiveRadiusMeters = null,
  message,
  location = null,
  deviceInfo = null,
  requiresSelection = false,
  candidateSites = null,
  lastUpdateSource,
}: BaseArgs): GeofenceCheckState {
  return {
    status: "error",
    canProceed: false,
    mode,
    lastUpdateSource,
    siteId,
    siteName,
    distanceMeters,
    accuracyMeters,
    effectiveRadiusMeters,
    message,
    updatedAt,
    location,
    deviceInfo,
    requiresSelection,
    candidateSites,
  };
}

type ReadyArgs = {
  mode: GeofenceMode;
  updatedAt: number;
  siteId: string;
  siteName: string | null;
  distanceMeters: number;
  accuracyMeters: number | null;
  effectiveRadiusMeters: number | null;
  message: string;
  location?: ValidatedLocation | null;
  deviceInfo?: Record<string, unknown> | null;
  lastUpdateSource?: UpdateSource;
};

export function buildGeofenceReadyState({
  mode,
  updatedAt,
  siteId,
  siteName,
  distanceMeters,
  accuracyMeters,
  effectiveRadiusMeters,
  message,
  location = null,
  deviceInfo = null,
  lastUpdateSource,
}: ReadyArgs): GeofenceCheckState {
  return {
    status: "ready",
    canProceed: true,
    mode,
    lastUpdateSource,
    siteId,
    siteName,
    distanceMeters,
    accuracyMeters,
    effectiveRadiusMeters,
    message,
    updatedAt,
    location,
    deviceInfo,
    isLatchedReady: false,
    latchedReason: null,
    latchExpiresAt: null,
    requiresSelection: false,
    candidateSites: null,
  };
}
