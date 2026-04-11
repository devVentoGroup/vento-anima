import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";

import { supabase } from "@/lib/supabase";
import type { DocumentRow } from "@/components/documents/types";
import {
  diffDays,
  formatDateOnly,
  formatShortDate,
  parseDateOnly,
} from "@/components/documents/date-utils";

const DOCUMENT_NOTIFICATION_KEY = "document_notifications_v1";
const DEFAULT_REMINDER_DAYS = 7;
const DOCUMENT_NOTIFICATION_CHANNEL = "document-alerts";
const EXPO_PROJECT_ID = "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotificationMap = Record<string, { id: string; fireAt: number }>;

export type AlertDocumentEntry = {
  doc: DocumentRow;
  daysLeft: number;
  reminderDays: number;
};

async function loadNotificationMap(): Promise<NotificationMap> {
  const stored = await SecureStore.getItemAsync(DOCUMENT_NOTIFICATION_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as NotificationMap;
  } catch {
    return {};
  }
}

async function saveNotificationMap(map: NotificationMap) {
  await SecureStore.setItemAsync(DOCUMENT_NOTIFICATION_KEY, JSON.stringify(map));
}

async function clearLocalNotifications() {
  const map = await loadNotificationMap();
  const ids = Object.values(map)
    .map((entry) => entry.id)
    .filter(Boolean);

  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  await saveNotificationMap({});
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DOCUMENT_NOTIFICATION_CHANNEL, {
    name: "Alertas de documentos",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

type UseDocumentNotificationsArgs = {
  userId: string | undefined;
  documents: DocumentRow[];
};

export function useDocumentNotifications({
  userId,
  documents,
}: UseDocumentNotificationsArgs) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [pushTokenReady, setPushTokenReady] = useState(false);
  const pushRegistrationRef = useRef(false);
  const pushTokenRegisteredRef = useRef(false);

  const refreshNotificationPermission = useCallback(async () => {
    const permissions = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(permissions.status === "granted");
  }, []);

  const registerPushToken = useCallback(async () => {
    if (!userId || !notificationsEnabled) return;
    if (!Device.isDevice) return;
    if (pushRegistrationRef.current) return;

    pushRegistrationRef.current = true;

    try {
      const tokenPromise = Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Push token timeout")), 10000);
      });

      const tokenResult = (await Promise.race([
        tokenPromise,
        timeoutPromise,
      ])) as Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;

      const token = tokenResult.data;
      if (!token) {
        pushRegistrationRef.current = false;
        return;
      }

      const upsertTimeout = setTimeout(() => {
        pushRegistrationRef.current = false;
      }, 8000);

      const { error } = await supabase.functions.invoke("register-push-token", {
        body: {
          token,
          platform: Platform.OS,
        },
      });

      clearTimeout(upsertTimeout);

      if (error) {
        pushRegistrationRef.current = false;
      } else {
        setPushTokenReady(true);
      }
    } catch (err) {
      console.error("Push token registration error:", err);
      pushRegistrationRef.current = false;
    }
  }, [notificationsEnabled, userId]);

  const syncDocumentNotifications = useCallback(
    async (docs: DocumentRow[]) => {
      if (!notificationsEnabled) return;
      setIsScheduling(true);
      try {
        await ensureAndroidChannel();
        const map = await loadNotificationMap();
        const nextMap: NotificationMap = {};
        const now = new Date();
        const today = parseDateOnly(formatDateOnly(now));
        const activeDocIds = new Set<string>();

        for (const doc of docs) {
          if (!doc.expiry_date) continue;

          const reminderDays =
            doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS;
          const expiry = parseDateOnly(doc.expiry_date);
          const daysLeft = diffDays(expiry, today);
          if (daysLeft <= 0) continue;

          const fireDate = new Date(expiry);
          fireDate.setDate(expiry.getDate() - reminderDays);
          fireDate.setHours(9, 0, 0, 0);

          if (fireDate.getTime() <= now.getTime()) continue;

          const fireAt = fireDate.getTime();
          activeDocIds.add(doc.id);

          const existing = map[doc.id];
          if (existing && existing.fireAt === fireAt) {
            nextMap[doc.id] = existing;
            continue;
          }

          if (existing?.id) {
            await Notifications.cancelScheduledNotificationAsync(existing.id);
          }

          const title = doc.document_type?.name ?? doc.title ?? "Documento por vencer";
          const body = `Vence el ${formatShortDate(doc.expiry_date)}`;
          const content: Notifications.NotificationContentInput = {
            title: "Documento por vencer",
            body: `${title}. ${body}.`,
            data: { documentId: doc.id },
            sound: "default",
          };
          const trigger: Notifications.NotificationTriggerInput =
            Platform.OS === "android"
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: fireDate,
                  channelId: DOCUMENT_NOTIFICATION_CHANNEL,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: fireDate,
                };

          const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger,
          });

          nextMap[doc.id] = { id: notificationId, fireAt };
        }

        for (const docId of Object.keys(map)) {
          if (activeDocIds.has(docId)) continue;
          const existing = map[docId];
          if (existing?.id) {
            await Notifications.cancelScheduledNotificationAsync(existing.id);
          }
        }

        await saveNotificationMap(nextMap);
      } catch (err) {
        console.error("Notifications sync error:", err);
      } finally {
        setIsScheduling(false);
      }
    },
    [notificationsEnabled],
  );

  useEffect(() => {
    void refreshNotificationPermission();
  }, [refreshNotificationPermission]);

  useEffect(() => {
    if (!notificationsEnabled) {
      pushTokenRegisteredRef.current = false;
      return;
    }
    if (pushTokenRegisteredRef.current) return;
    if (pushTokenReady) {
      pushTokenRegisteredRef.current = true;
      return;
    }

    pushTokenRegisteredRef.current = true;
    void registerPushToken();
  }, [notificationsEnabled, pushTokenReady, registerPushToken]);

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (pushTokenReady) return;
    void syncDocumentNotifications(documents);
  }, [documents, notificationsEnabled, pushTokenReady, syncDocumentNotifications]);

  useEffect(() => {
    if (!pushTokenReady) return;
    void clearLocalNotifications();
  }, [pushTokenReady]);

  const alertDocuments = useMemo(() => {
    const today = parseDateOnly(formatDateOnly(new Date()));
    return documents
      .filter((doc) => !!doc.expiry_date)
      .map((doc) => {
        const expiry = parseDateOnly(doc.expiry_date!);
        const reminderDays =
          doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS;
        return { doc, daysLeft: diffDays(expiry, today), reminderDays };
      })
      .filter(({ daysLeft, reminderDays }) => daysLeft <= reminderDays)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [documents]);

  return {
    notificationsEnabled,
    isScheduling,
    pushTokenReady,
    alertDocuments,
  };
}
