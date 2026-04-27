import { BASE_BRAND } from "@/brand/base/config/app-brand"

export const BASE_COPY = {
  notificationsBlockedTitle: "Notificaciones desactivadas",
  notificationsBlockedBody: `Para recibir avisos de ${BASE_BRAND.appName} activa las notificaciones en Ajustes del dispositivo.`,
  notificationsEnabledBody: `Ya recibirás avisos de ${BASE_BRAND.appName}.`,
  settingsNotificationsBlockedBody: `${BASE_BRAND.appName} no puede enviar avisos porque el permiso está bloqueado. Actívalo desde Ajustes.`,
  settingsNotificationsEnabledBody: `Ya recibirás avisos de ${BASE_BRAND.appName}.`,
  settingsManageAccountBody: `Administra tu información sin salir de ${BASE_BRAND.appName}. Puedes limpiar datos opcionales cuando quieras.`,
  userMenuSignOutSubtitle: `Salir de ${BASE_BRAND.appName}`,
  attendanceReportSubject: `Reporte de asistencia ${BASE_BRAND.appName}`,
  supportAndroidPermissionsFaq: [
    `En Configuración > Permisos de ${BASE_BRAND.appName}, habilita Ubicación y Notificaciones.`,
    `Si el permiso aparece bloqueado, usa el botón Abrir ajustes en Configuración de ${BASE_BRAND.appName}.`,
    "Vuelve a la app y entra a Home para que el estado de permisos se refresque.",
  ],
  teamExistingUserNeedsPasswordBody: `Este usuario ya existía en el sistema. Si necesita acceso, debe usar «¿Olvidaste tu contraseña?» en ${BASE_BRAND.appName}.`,
  announcementsDocumentsTeaser: `Pronto podrás firmar documentos desde la app sin salir de ${BASE_BRAND.appName}.`,
} as const

export type BaseCopy = typeof BASE_COPY
