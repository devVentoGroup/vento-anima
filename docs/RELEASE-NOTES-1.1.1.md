# ANIMA 1.1.1 — Notas de release (cambios desde 1.1.0)

## Notas para el equipo de revisión (App Store / Play Store)

**Versión:** 1.1.1  
**Resumen para revisores:**

- **Turnos (Horarios):** Nueva pantalla "Horarios" donde el trabajador ve sus turnos publicados, fechas y sedes. Notificaciones push para recordatorio de cierre de turno y aviso de cierre automático; al tocarlas la app abre la pantalla de Horarios. La lógica de cuándo se envían (minutos antes/después) se configura en servidor.
- **Invitaciones de equipo:** Los gestores pueden invitar, reenviar y cancelar invitaciones desde la pantalla Equipo. Aceptación de invitación por enlace (flujo existente, mejorado en backend). No se añaden permisos nuevos.
- **Actualización obligatoria:** La política de actualización (versión mínima, forzar actualización, enlace a tienda) se lee desde el servidor; la app solo muestra el modal y abre la tienda. Enlace a App Store configurado para esta app.
- **Pantalla Operativo:** Para roles de gestión: acceso a reporte operativo desde la app (datos de asistencia/turnos).
- **Soporte:** Modal de contacto para trabajadores (soporte interno).
- **Anuncios y home:** Ajustes en visualización y filtros; integración de información de turnos en la pantalla de inicio.
- Permisos sin cambios: ubicación (validación de asistencia en sede), notificaciones push (turnos, recordatorios, anuncios).
- No hay cambios en recopilación de datos personales ni en flujos de registro o inicio de sesión más allá de lo indicado.

---

## Notas de la versión para los trabajadores

**¿Qué hay de nuevo en ANIMA 1.1.1 (desde 1.1.0)**

### Horarios (turnos)
- Nueva pestaña **Horarios**: ves tus turnos publicados, con fecha, sede y hora. Puedes consultarlos cuando quieras.
- **Recordatorio de cierre de turno:** Te llegará un aviso (push) para que cierres tu turno a tiempo. El aviso puede enviarse unos minutos antes de tu hora de salida y, si se te pasó la hora, también unos minutos después, para que no te quedes sin el aviso. Si tocas la notificación, se abre la pantalla de Horarios.
- Si no registras salida y pasa el tiempo configurado, el sistema puede cerrar el turno automáticamente y te avisará por notificación.

### Equipo (para gestores)
- Invitaciones a nuevos trabajadores: crear, reenviar y cancelar invitaciones desde la app, con mejor seguimiento de pendientes.

### Inicio y reportes
- En la pantalla de inicio se integra la información de tu próximo turno cuando aplica.
- Los gestores pueden acceder al reporte operativo desde la app (pestaña Operativo cuando aplique).

### Actualizaciones y soporte
- La app puede pedirte que actualices cuando haya una versión nueva obligatoria; el enlace te llevará a la tienda (App Store o Play Store) según tu dispositivo.
- Mejoras en la pantalla de soporte y en el contacto con el equipo interno.

### Estabilidad
- Ajustes internos y mejoras de estabilidad para que la app funcione correctamente con las últimas actualizaciones del sistema.

Si tienes problemas con los recordatorios, los turnos o la app, coméntalo a tu encargado o al equipo de soporte.
