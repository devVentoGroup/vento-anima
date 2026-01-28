# ✅ Checklist Completa: Lanzamiento iOS y Android - ANIMA

> Guía paso a paso para preparar, buildar y publicar ANIMA en App Store y Google Play.
> Estado basado en la configuración actual de `vento-anima` (app.config.js, eas.json, package.json).

---

## 📌 Progreso General (estimado)

### Progreso Total: **28%** 🟨

```
[############################............................................] 28%
```

### Progreso por Sección

| Sección | Completado | Total | Progreso | Estado |
|---------|------------|-------|----------|--------|
| 1. Preparación Inicial | 6 | 8 | **75%** | 🟨 En progreso |
| 2. Cuentas de Desarrollador | 0 | 8 | **0%** | ⏳ Pendiente |
| 3. Configuración del Proyecto | 8 | 15 | **53%** | 🟨 En progreso |
| 4. Assets y Recursos Visuales | 3 | 10 | **30%** | ⏳ Pendiente |
| 5. Configuración de Build | 3 | 12 | **25%** | ⏳ Pendiente |
| 6. Testing y QA | 0 | 16 | **0%** | ⏳ Pendiente |
| 7. Lanzamiento iOS | 0 | 22 | **0%** | ⏳ Pendiente |
| 8. Lanzamiento Android | 0 | 20 | **0%** | ⏳ Pendiente |
| 9. Post-Lanzamiento | 0 | 12 | **0%** | ⏳ Pendiente |

---

## ✅ Estado real del repo ANIMA (auditoría rápida)

**Ya tenemos:**
- ✅ Expo SDK 54 + React Native 0.81 (package.json).
- ✅ `app.config.js` con `name: ANIMA`, `slug: anima`, `scheme: anima`.
- ✅ `ios.bundleIdentifier: com.vento.anima`.
- ✅ `android.package: com.vento.anima`.
- ✅ `splash` configurado con fondo `#F7F5F8`.
- ✅ Iconos con padding: `assets/icon-padded.png` y `assets/adaptive-icon-padded.png`.
- ✅ EAS config con perfiles `development`, `preview`, `production` (eas.json).
- ✅ `ITSAppUsesNonExemptEncryption: false` en iOS.
- ✅ Permisos Android de ubicación: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- ✅ Base de datos Docs + Soporte + Push tokens (SQL aplicado).

**Faltantes detectados (clave para release):**
- ⏳ Apple Developer account y App Store Connect (no confirmado).
- ⏳ Google Play Console (no confirmado).
- ⏳ Variables EAS (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- ⏳ `ios.buildNumber` y `android.versionCode` (no definidos en app.config.js).
- ⏳ Screenshots oficiales (iOS/Android) y textos de tienda.
- ⏳ Política de privacidad pública y URL en stores.
- ⏳ Credenciales de prueba para reviewers (login email/password).
- ⏳ Formularios de privacidad: App Privacy (iOS) + Data Safety (Android).
- ⏳ Content rating + pricing/distribution (iOS/Android).
- ⏳ QA formal en dispositivos reales (iOS + Android).

---

## 🔥 Prioridades (orden recomendado)

1) **EAS env variables (Supabase)**  
2) **Versionado iOS/Android (buildNumber / versionCode)**  
3) **Builds EAS de producción**  
4) **App Store Connect / Play Console**  
5) **Credenciales review + formularios de privacidad/ratings**  
6) **QA en dispositivos reales**  
7) **Assets oficiales (screenshots + icono final)**  

---

## 1. Preparación Inicial

- [x] Node.js >= 18 instalado
- [x] npm actualizado
- [x] Expo CLI via npx disponible
- [x] EAS CLI disponible
- [x] Git configurado
- [ ] `npx expo doctor` sin errores (verificar)
- [ ] `npx tsc --noEmit` sin errores (verificar)
- [ ] Limpiar cachés (Metro + watchman) antes de release

---

## 2. Cuentas de Desarrollador

**iOS**
- [ ] Apple Developer Program (Organization)
- [ ] App Store Connect: app creada (ANIMA)
- [ ] Acceso a certificados y dispositivos (EAS los gestiona)

**Android**
- [ ] Google Play Console creado
- [ ] Registro de app en Play Console
- [ ] Service account (si usamos EAS Submit)

---

## 3. Configuración del Proyecto (ANIMA)

- [x] `name`, `slug`, `scheme` correctos
- [x] `bundleIdentifier` iOS correcto
- [x] `package` Android correcto
- [x] Splash configurado
- [x] Icono iOS configurado
- [x] Adaptive icon Android configurado
- [ ] `ios.buildNumber` definido
- [ ] `android.versionCode` definido
- [ ] iOS: `NSLocationWhenInUseUsageDescription` (y otros si aplica) en `ios.infoPlist`
- [ ] URL de política de privacidad (pública)
- [ ] Términos de servicio (opcional)
- [ ] Configurar `notifications` (si usaremos push)

---

## 4. Assets y Recursos Visuales

- [x] Icono 1024x1024 con padding
- [x] Adaptive icon foreground con padding
- [x] Splash oficial (fondo + logo)
- [ ] Screenshots iOS (6.7", 6.1")
- [ ] Screenshots Android (phone + tablet opcional)
- [ ] App preview video (opcional)
- [ ] Texto de descripción de tienda (ES)

---

## 5. Configuración de Build (EAS Build)

- [x] `eas.json` con perfiles dev/preview/production
- [x] `appVersionSource: remote`
- [ ] Definir variables en EAS:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Crear build de producción iOS
- [ ] Crear build de producción Android (AAB)
- [ ] Verificar versionado automático (autoIncrement)

---

## 6. Testing y QA

- [ ] Login / auth completo
- [ ] Check-in / check-out con GPS real
- [ ] Historial y filtros semana/mes
- [ ] Documentos (subir PDF, ver, estados)
- [ ] Soporte (ticket + seguimiento)
- [ ] Notificaciones push (si aplica)
- [ ] Pruebas con red lenta
- [ ] Prueba en iOS real + Android real

---

## 7. Lanzamiento iOS (App Store)

- [ ] Crear app en App Store Connect
- [ ] Subir build (EAS submit)
- [ ] Completar metadata (nombre, descripción, keywords)
- [ ] Completar App Review Information (contacto + notas + credenciales demo)
- [ ] Completar App Privacy (data collection)
- [ ] Completar Age Rating + Pricing/Availability
- [ ] Subir screenshots iOS
- [ ] Completar “Información de la prueba” (TestFlight)
- [ ] Iniciar TestFlight interno
- [ ] Enviar a revisión

---

## 8. Lanzamiento Android (Google Play)

- [ ] Crear app en Play Console
- [ ] Subir AAB (EAS submit)
- [ ] Completar ficha (short/long description)
- [ ] Completar App access (credenciales demo email/password)
- [ ] Completar Data Safety (privacidad)
- [ ] Completar Content rating questionnaire
- [ ] Configurar Pricing & distribution
- [ ] Subir screenshots Android
- [ ] Declarar permisos (ubicación)
- [ ] Iniciar testing interno
- [ ] Enviar a revisión

---

## 9. Post‑Lanzamiento

- [ ] Monitor de crashes (Sentry/Firebase)
- [ ] Analytics (eventos clave)
- [ ] Responder feedback de testers
- [ ] Roadmap de updates (versionado)
- [ ] Backups de credenciales (Apple/Google/EAS)

---

## 🧭 Comandos útiles

```bash
# Build de producción iOS
eas build --platform ios --profile production

# Build de producción Android
eas build --platform android --profile production

# Subir a tiendas
eas submit --platform ios --latest
eas submit --platform android --latest
```

---

## ✅ Próximo paso recomendado (ANIMA)

1) Crear variables EAS (Supabase).  
2) Definir `ios.buildNumber` y `android.versionCode`.  
3) Ejecutar build production iOS + Android.  

---

**Notas**  
Si quieres, puedo actualizar este checklist con % reales cuando me confirmes:
- Estado Apple Developer / App Store Connect  
- Estado Google Play Console  
- Si ya hay builds en EAS  
