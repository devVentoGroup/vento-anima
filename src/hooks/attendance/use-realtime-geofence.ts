import { useCallback, useEffect, useRef } from "react";

import * as Location from "expo-location";

import { buildValidatedLocationFromRaw } from "@/lib/geolocation";
import type { AttendanceState, GeofenceCheckState, GeofenceMode } from "@/hooks/attendance/shared";

type RefreshGeofence = (args: {
  force?: boolean;
  mode?: GeofenceMode;
  siteId?: string | null;
  location?: ReturnType<typeof buildValidatedLocationFromRaw> | null;
  silent?: boolean;
  source?: "auto" | "user" | "check_action";
}) => Promise<GeofenceCheckState>;

type UseRealtimeGeofenceArgs = {
  attendanceStatus: AttendanceState["status"];
  refreshGeofence: RefreshGeofence;
  registerOpenShiftDepartureEvent: (
    location: ReturnType<typeof buildValidatedLocationFromRaw>,
  ) => Promise<void>;
};

export function useRealtimeGeofence({
  attendanceStatus,
  refreshGeofence,
  registerOpenShiftDepartureEvent,
}: UseRealtimeGeofenceArgs) {
  const realtimeWatchRef = useRef<Location.LocationSubscription | null>(null);
  const lastRealtimeTickRef = useRef(0);
  const refreshGeofenceRealtimeRef = useRef(refreshGeofence);
  const registerOpenShiftDepartureEventRef =
    useRef(registerOpenShiftDepartureEvent);

  useEffect(() => {
    refreshGeofenceRealtimeRef.current = refreshGeofence;
  }, [refreshGeofence]);

  useEffect(() => {
    registerOpenShiftDepartureEventRef.current = registerOpenShiftDepartureEvent;
  }, [registerOpenShiftDepartureEvent]);

  const startRealtimeGeofence = useCallback(async () => {
    if (realtimeWatchRef.current) return;
    const isCheckedInNow = attendanceStatus === "checked_in";

    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== "granted") return;

    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) return;

    const watchOptions: Location.LocationOptions = isCheckedInNow
      ? {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 20,
          mayShowUserSettingsDialog: true,
        }
      : {
          accuracy: Location.Accuracy.High,
          timeInterval: 6000,
          distanceInterval: 10,
          mayShowUserSettingsDialog: true,
        };

    const subscription = await Location.watchPositionAsync(
      watchOptions,
      (rawLocation) => {
        const now = Date.now();
        const minTickMs = isCheckedInNow ? 4000 : 2500;
        if (now - lastRealtimeTickRef.current < minTickMs) return;
        lastRealtimeTickRef.current = now;

        const validated = buildValidatedLocationFromRaw(rawLocation);
        void refreshGeofenceRealtimeRef.current({
          force: true,
          location: validated,
          silent: true,
          source: "auto",
        });
        void registerOpenShiftDepartureEventRef.current(validated);
      },
    );

    realtimeWatchRef.current = subscription;
  }, [attendanceStatus]);

  const stopRealtimeGeofence = useCallback(() => {
    if (realtimeWatchRef.current) {
      realtimeWatchRef.current.remove();
      realtimeWatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopRealtimeGeofence();
  }, [stopRealtimeGeofence]);

  useEffect(() => {
    if (!realtimeWatchRef.current) return;
    stopRealtimeGeofence();
    void startRealtimeGeofence();
  }, [attendanceStatus, startRealtimeGeofence, stopRealtimeGeofence]);

  return {
    startRealtimeGeofence,
    stopRealtimeGeofence,
  };
}
