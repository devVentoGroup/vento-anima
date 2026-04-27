import { BASE_COPY } from "@/brand/base/copy/app-copy";
import { ANIMA_BRAND } from "@/brand/anima/config/app-brand";

export const ANIMA_COPY = {
  ...BASE_COPY,
  notificationsBlockedTitle: "Notificaciones desactivadas",
  notificationsBlockedBody: `Para recibir avisos de ${ANIMA_BRAND.appName} activa las notificaciones en Ajustes del dispositivo.`,
  notificationsEnabledBody: `Ya recibirás avisos de ${ANIMA_BRAND.appName}.`,
  settingsNotificationsBlockedBody: `${ANIMA_BRAND.appName} no puede enviar avisos porque el permiso está bloqueado. Actívalo desde Ajustes.`,
  settingsNotificationsEnabledBody: `Ya recibirás avisos de ${ANIMA_BRAND.appName}.`,
  settingsManageAccountBody: `Administra tu información sin salir de ${ANIMA_BRAND.appName}. Puedes limpiar datos opcionales cuando quieras.`,
  userMenuSignOutSubtitle: `Salir de ${ANIMA_BRAND.appName}`,
  attendanceReportSubject: `Reporte de asistencia ${ANIMA_BRAND.appName}`,
  supportAndroidPermissionsFaq: [
    `En Configuración > Permisos de ${ANIMA_BRAND.appName}, habilita Ubicación y Notificaciones.`,
    `Si el permiso aparece bloqueado, usa el botón Abrir ajustes en Configuración de ${ANIMA_BRAND.appName}.`,
    "Vuelve a la app y entra a Home para que el estado de permisos se refresque.",
  ],
  teamExistingUserNeedsPasswordBody: `Este usuario ya existía en el sistema. Si necesita acceso, debe usar «¿Olvidaste tu contraseña?» en ${ANIMA_BRAND.appName}.`,
  announcementsDocumentsTeaser: `Pronto podrás firmar documentos desde la app sin salir de ${ANIMA_BRAND.appName}.`,
} as const;
