import { BASE_COPY } from "@/brand/base/copy/app-copy"
import { TEMPLATE_BRAND } from "@/brand/template/config/app-brand"

export const TEMPLATE_COPY = {
  ...BASE_COPY,
  notificationsBlockedBody: `Para recibir avisos de ${TEMPLATE_BRAND.appName} activa las notificaciones en Ajustes del dispositivo.`,
  notificationsEnabledBody: `Ya recibirás avisos de ${TEMPLATE_BRAND.appName}.`,
  settingsNotificationsBlockedBody: `${TEMPLATE_BRAND.appName} no puede enviar avisos porque el permiso está bloqueado. Actívalo desde Ajustes.`,
  settingsNotificationsEnabledBody: `Ya recibirás avisos de ${TEMPLATE_BRAND.appName}.`,
  settingsManageAccountBody: `Administra tu información sin salir de ${TEMPLATE_BRAND.appName}. Puedes limpiar datos opcionales cuando quieras.`,
  userMenuSignOutSubtitle: `Salir de ${TEMPLATE_BRAND.appName}`,
  attendanceReportSubject: `Reporte de asistencia ${TEMPLATE_BRAND.appName}`,
  supportAndroidPermissionsFaq: [
    `En Configuración > Permisos de ${TEMPLATE_BRAND.appName}, habilita Ubicación y Notificaciones.`,
    `Si el permiso aparece bloqueado, usa el botón Abrir ajustes en Configuración de ${TEMPLATE_BRAND.appName}.`,
    "Vuelve a la app y entra a Home para que el estado de permisos se refresque.",
  ],
  teamExistingUserNeedsPasswordBody: `Este usuario ya existía en el sistema. Si necesita acceso, debe usar «¿Olvidaste tu contraseña?» en ${TEMPLATE_BRAND.appName}.`,
  announcementsDocumentsTeaser: `Pronto podrás firmar documentos desde la app sin salir de ${TEMPLATE_BRAND.appName}.`,
} as const
