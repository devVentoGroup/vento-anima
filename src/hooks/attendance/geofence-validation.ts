import { calculateDistance, type SiteCoordinates, type ValidatedLocation } from "@/lib/geolocation";
import {
  buildGeofenceBlockedState,
  buildGeofenceErrorState,
  buildGeofenceReadyState,
} from "@/hooks/attendance/geofence-state";
import { findBlockingGeoWarning, type GeofenceCheckState, type GeofenceMode } from "@/hooks/attendance/shared";

type ValidateArgs = {
  mode: GeofenceMode;
  site: SiteCoordinates;
  hasCoordinates: boolean;
  policy: { maxAccuracyMeters: number };
  updatedAt: number;
  location: ValidatedLocation | null;
  buildDeviceInfoPayload: (
    location: ValidatedLocation | null,
    extra?: Record<string, unknown>,
  ) => Record<string, unknown> | null;
};

export function buildResolvedSitePreflightState({
  mode,
  site,
  hasCoordinates,
  updatedAt,
}: {
  mode: GeofenceMode;
  site: SiteCoordinates;
  hasCoordinates: boolean;
  updatedAt: number;
}): GeofenceCheckState | null {
  if (site.requiresGeolocation && !hasCoordinates) {
    return buildGeofenceErrorState({
      mode,
      siteId: site.id,
      siteName: site.name,
      message: "La sede no tiene coordenadas configuradas",
      updatedAt,
    });
  }

  if (!site.requiresGeolocation) {
    return buildGeofenceReadyState({
      mode,
      siteId: site.id,
      siteName: site.name,
      distanceMeters: 0,
      accuracyMeters: null,
      effectiveRadiusMeters: null,
      message: "Esta sede no requiere GPS",
      updatedAt,
    });
  }

  const effectiveRadius = Number(site.radiusMeters ?? 0);
  if (!Number.isFinite(effectiveRadius) || effectiveRadius <= 0) {
    return buildGeofenceErrorState({
      mode,
      siteId: site.id,
      siteName: site.name,
      message: "La sede no tiene radio de check-in configurado",
      updatedAt,
    });
  }

  return null;
}

export function validateResolvedSiteGeofence({
  mode,
  site,
  hasCoordinates,
  policy,
  updatedAt,
  location,
  buildDeviceInfoPayload,
}: ValidateArgs): GeofenceCheckState {
  const preflight = buildResolvedSitePreflightState({
    mode,
    site,
    hasCoordinates,
    updatedAt,
  });
  if (preflight) return preflight;

  const effectiveRadius = Number(site.radiusMeters ?? 0);

  if (!location) {
    return buildGeofenceErrorState({
      mode,
      siteId: site.id,
      siteName: site.name,
      effectiveRadiusMeters: effectiveRadius,
      message: "Ubicación requerida para continuar",
      updatedAt,
    });
  }

  const distanceRaw = calculateDistance(
    location.latitude,
    location.longitude,
    site.latitude,
    site.longitude,
  );
  const distanceMeters = Math.round(distanceRaw);
  const blocking = findBlockingGeoWarning(location);

  if (blocking) {
    return buildGeofenceBlockedState({
      mode,
      siteId: site.id,
      siteName: site.name,
      distanceMeters,
      accuracyMeters: location.accuracy ?? null,
      effectiveRadiusMeters: effectiveRadius,
      message: `Ubicación no válida: ${blocking}. Desactiva ubicaciones simuladas y vuelve a intentar.`,
      updatedAt,
      location,
      deviceInfo: buildDeviceInfoPayload(location, {
        geofence: {
          distanceMeters,
          effectiveRadiusMeters: effectiveRadius,
          maxAccuracyMeters: policy.maxAccuracyMeters,
        },
      }),
    });
  }

  const accuracy = location.accuracy ?? 999;
  if (accuracy > policy.maxAccuracyMeters) {
    return buildGeofenceBlockedState({
      mode,
      siteId: site.id,
      siteName: site.name,
      distanceMeters,
      accuracyMeters: accuracy,
      effectiveRadiusMeters: effectiveRadius,
      message: `Precisión GPS insuficiente (${Math.round(
        accuracy,
      )}m). Debe ser <= ${policy.maxAccuracyMeters}m para registrar.`,
      updatedAt,
      location,
      deviceInfo: buildDeviceInfoPayload(location, {
        geofence: {
          distanceMeters,
          effectiveRadiusMeters: effectiveRadius,
          maxAccuracyMeters: policy.maxAccuracyMeters,
        },
      }),
    });
  }

  const distance = distanceRaw ?? 999999;
  if (distance + accuracy > effectiveRadius) {
    return buildGeofenceBlockedState({
      mode,
      siteId: site.id,
      siteName: site.name,
      distanceMeters: Math.round(distance),
      accuracyMeters: accuracy,
      effectiveRadiusMeters: effectiveRadius,
      message: `Estás a ${Math.round(distance)}m y la precisión es ${Math.round(
        accuracy,
      )}m. Validación real: ${Math.round(distance + accuracy)}m <= ${effectiveRadius}m.`,
      updatedAt,
      location,
      deviceInfo: buildDeviceInfoPayload(location, {
        geofence: {
          distanceMeters: Math.round(distance),
          effectiveRadiusMeters: effectiveRadius,
          maxAccuracyMeters: policy.maxAccuracyMeters,
        },
      }),
    });
  }

  return buildGeofenceReadyState({
    mode,
    siteId: site.id,
    siteName: site.name,
    distanceMeters: Math.round(distance),
    accuracyMeters: accuracy,
    effectiveRadiusMeters: effectiveRadius,
    message: "Ubicación verificada",
    updatedAt,
    location,
    deviceInfo: buildDeviceInfoPayload(location, {
      geofence: {
        distanceMeters: Math.round(distance),
        effectiveRadiusMeters: effectiveRadius,
        maxAccuracyMeters: policy.maxAccuracyMeters,
      },
    }),
  });
}
