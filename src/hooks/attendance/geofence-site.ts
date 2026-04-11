import * as Location from "expo-location";

import {
  buildValidatedLocationFromRaw,
  calculateDistance,
  type SiteCoordinates,
  type ValidatedLocation,
} from "@/lib/geolocation";
import type { SiteCandidate } from "@/hooks/attendance/shared";
import { supabase } from "@/lib/supabase";

type EmployeeSiteLike = {
  siteId: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};

type SiteCacheValue = {
  site: SiteCoordinates;
  hasCoordinates: boolean;
  cachedAt: number;
};

type ResolveAttendanceSiteArgs = {
  siteId: string;
  employeeSites: EmployeeSiteLike[];
  cache: Map<string, SiteCacheValue>;
  cacheMs: number;
};

export async function resolveAttendanceSite({
  siteId,
  employeeSites,
  cache,
  cacheMs,
}: ResolveAttendanceSiteArgs): Promise<{
  site: SiteCoordinates | null;
  hasCoordinates: boolean;
}> {
  const now = Date.now();
  const cached = cache.get(siteId);
  if (cached && now - cached.cachedAt <= cacheMs) {
    return { site: cached.site, hasCoordinates: cached.hasCoordinates };
  }

  const { data, error } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude, checkin_radius_meters, type")
    .eq("id", siteId)
    .single();

  if (error || !data) {
    console.error("[resolveSite] Error obteniendo sede de BD:", error);
    if (cached) {
      console.warn("[resolveSite] Usando sede en cache por falla de red");
      return { site: cached.site, hasCoordinates: cached.hasCoordinates };
    }

    const fromList = employeeSites.find((item) => item.siteId === siteId);
    if (fromList) {
      console.warn("[resolveSite] Usando employeeSites como fallback");
      const hasCoordinates =
        fromList.latitude != null && fromList.longitude != null;
      const result = {
        site: {
          id: fromList.siteId,
          name: fromList.siteName,
          latitude: fromList.latitude ?? 0,
          longitude: fromList.longitude ?? 0,
          radiusMeters: fromList.radiusMeters ?? 0,
          requiresGeolocation: hasCoordinates,
        },
        hasCoordinates,
      };
      cache.set(siteId, {
        site: result.site,
        hasCoordinates,
        cachedAt: now,
      });
      return result;
    }

    return { site: null, hasCoordinates: false };
  }

  const hasCoordinates = data.latitude != null && data.longitude != null;
  let radiusMeters = data.checkin_radius_meters ?? 0;
  let requiresGeolocation = hasCoordinates;

  try {
    const { data: policyRow } = await supabase
      .from("site_attendance_policy")
      .select("checkin_radius_meters, requires_geofence")
      .eq("site_id", siteId)
      .maybeSingle();

    if (policyRow) {
      if (policyRow.checkin_radius_meters != null) {
        radiusMeters = Number(policyRow.checkin_radius_meters);
      }
      if (policyRow.requires_geofence != null) {
        requiresGeolocation = Boolean(policyRow.requires_geofence);
      }
    }
  } catch {
    // Tabla inexistente o sin permiso: usar solo datos de sites.
  }

  const result = {
    site: {
      id: data.id,
      name: data.name,
      latitude: data.latitude ?? 0,
      longitude: data.longitude ?? 0,
      radiusMeters,
      requiresGeolocation,
    },
    hasCoordinates,
  };

  cache.set(siteId, {
    site: result.site,
    hasCoordinates,
    cachedAt: now,
  });

  return result;
}

export async function resolveBestEffortSelectionLocation(
  location: ValidatedLocation | null,
): Promise<ValidatedLocation | null> {
  if (location) return location;

  try {
    const permissions = await Location.getForegroundPermissionsAsync();
    if (permissions.status !== "granted") {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status !== "granted") return null;
    }
  } catch {
    return null;
  }

  try {
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 150,
    });
    if (lastKnown) {
      return buildValidatedLocationFromRaw(lastKnown);
    }
  } catch {
    // Best-effort only.
  }

  try {
    const currentPosition = (await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 7000),
      ),
    ])) as Location.LocationObject;

    if (currentPosition?.coords) {
      return buildValidatedLocationFromRaw(currentPosition);
    }
  } catch {
    // Best-effort only.
  }

  return null;
}

export function buildSelectionCandidates(
  employeeSites: EmployeeSiteLike[],
  baseLocation: ValidatedLocation | null,
): SiteCandidate[] {
  return employeeSites.map((item) => {
    const effectiveRadius = Number(item.radiusMeters ?? 0);
    const hasCoordinates =
      item.latitude != null && item.longitude != null;
    const distance =
      baseLocation && hasCoordinates
        ? Math.round(
            calculateDistance(
              baseLocation.latitude,
              baseLocation.longitude,
              item.latitude as number,
              item.longitude as number,
            ),
          )
        : null;

    return {
      id: item.siteId,
      name: item.siteName,
      distanceMeters: distance,
      effectiveRadiusMeters: effectiveRadius,
      requiresGeolocation: hasCoordinates,
    };
  });
}
