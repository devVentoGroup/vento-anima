# ANIMA White-Label Foundation

Objetivo: reorganizar `vento-anima` para que siga operando como app actual, pero quede lista para extraer una base reutilizable y montar futuras marcas blancas con friccion baja.

## 1. Principio de trabajo

No vamos a rehacer la app ni a mover todo de una sola vez.

Vamos a separar el repo en capas estables:

- `brand`: marca, assets, textos visibles, nombres, schemes, keys por app.
- `core`: piezas reutilizables sin dominio ni marca.
- `domains`: modulos funcionales de negocio.
- `infra`: integraciones externas y clientes tecnicos.

La app actual ANIMA sigue siendo el producto operativo. La reorganizacion busca que despues sea facil:

- extraer un modelo base
- crear otra marca sobre la misma base
- mantener ANIMA sin romper rutas ni releases

## 2. Estructura objetivo

Estado actual resumido:

- `app/`: rutas Expo Router
- `src/components/*`: UI por vertical
- `src/contexts`, `src/hooks`, `src/lib`, `src/constants`, `src/utils`: capas mezcladas

Estructura objetivo gradual:

```text
app/
src/
  brand/
    base/
      config/
      copy/
      theme/
    anima/
      assets/
      config/
      copy/
      theme/
    template/
      config/
      copy/
  core/
    auth/
    config/
    navigation/
    permissions/
    ui/
    errors/
    hooks/
    types/
  domains/
    attendance/
    announcements/
    documents/
    history/
    settings/
    shifts/
    support/
    team/
  infra/
    supabase/
    monitoring/
    notifications/
    geolocation/
```

## 3. Regla de cada capa

### `brand`

Debe contener todo lo que cambia entre una marca y otra:

- nombre comercial
- logo
- paleta
- textos de UI que hoy dicen "ANIMA"
- deep links / scheme
- `appUpdateKey`
- assets de splash/icon

No debe contener logica de negocio.

La estructura recomendada ahora es:

- `brand/base`: defaults y contratos de marca reutilizables
- `brand/anima`: overrides concretos de ANIMA sobre la base

Regla practica:

- `base` define el shape
- cada marca concreta compone `base` y sobreescribe solo lo que cambia
- `template` sirve como referencia neutral para futuras marcas

### `core`

Debe contener piezas que pueden sobrevivir aunque cambie la vertical o la marca:

- `AuthProvider` base
- guards de navegacion
- primitives de UI
- manejo de errores
- hooks genericos
- tipos compartidos
- carga de configuracion

No debe conocer asistencia, documentos, turnos ni soporte.

### `domains`

Cada modulo funcional debe vivir aqui:

- servicios
- hooks del dominio
- componentes del dominio
- tipos del dominio

Ejemplo:

- `domains/attendance/*`
- `domains/team/*`
- `domains/shifts/*`

### `infra`

Todo adaptador tecnico o integracion:

- cliente Supabase
- Sentry / monitoreo
- geolocalizacion
- push notifications
- wallet

No debe mezclar copy de UI ni decisiones de dominio.

## 4. Mapeo inicial del repo actual

### Rutas

`app/` puede quedarse igual al inicio.

La primera meta no es mover rutas, sino hacer que las pantallas importen desde capas mas limpias.

### Archivos que hoy son cuellos de botella

- `src/contexts/auth-context.tsx`
- `src/hooks/use-attendance.ts`
- `app/(app)/home.tsx`

Estos tres archivos hoy mezclan varias responsabilidades. Son el primer foco tecnico.

### Archivos con acoplamiento de marca

- `app.config.js`
- `src/components/SplashScreen.tsx`
- `src/components/anima-logo.tsx`
- `src/components/auth/login/LoginHeader.tsx`
- textos hardcodeados en pantallas como `home`, `support`, `team`, `account-settings`

## 5. Fases recomendadas

## Fase 0. Regla de organizacion

Antes de mover logica:

- toda pieza nueva debe nacer ya en `brand`, `core`, `domains` o `infra`
- evitar crear mas logica en `src/lib`, `src/hooks` o `src/contexts` si ya pertenece a una capa nueva

Objetivo: dejar de aumentar la deuda mientras se reorganiza.

## Fase 1. Centralizar branding y config

Crear:

- `src/brand/base/config/*`
- `src/brand/base/copy/*`
- `src/brand/anima/config/app-brand.ts`
- `src/brand/anima/theme/*`
- `src/brand/anima/copy/*`

Mover ahi:

- nombre ANIMA
- company footer
- labels repetidos
- `appUpdateKey` y constantes de app cuando aplique

Resultado esperado:

- la marca deja de estar dispersa
- la capa base de white-label ya existe en codigo
- ya hay una segunda marca de referencia dentro del repo
- cambiar el branding futuro sera una operacion localizada

### Patrón minimo de una nueva marca

Cada marca nueva deberia nacer con estas cuatro piezas:

- `brand/<marca>/config/app-brand.ts`
- `brand/<marca>/config/runtime.ts`
- `brand/<marca>/copy/app-copy.ts`
- `brand/<marca>/config/expo-brand.js`

La marca nueva no debe redefinir todo. Debe componer desde `brand/base/*`.

## Fase 2. Partir `auth-context`

Extraer responsabilidades a modulos internos:

- `core/auth/use-session-state`
- `core/auth/use-employee-profile`
- `core/auth/use-employee-sites`
- `core/auth/use-auth-routing-guard`
- `infra/notifications/use-push-token-registration`

Resultado esperado:

- el provider queda liviano
- auth deja de ser cuello de botella
- mas facil reutilizar auth en otra app

## Fase 3. Partir `home.tsx`

Separar por casos de uso, no solo por presentacion:

- `domains/attendance/home/use-home-attendance-actions`
- `domains/shifts/home/use-next-shift`
- `domains/reports/home/use-report-summary`
- `domains/wallet/home/use-wallet-eligibility`
- componentes: `AttendanceCard`, `NextShiftCard`, `QuickActionsCard`, etc.

Resultado esperado:

- la pantalla deja de ser un "super controller"
- el dominio queda portable

## Fase 4. Partir `use-attendance`

Separar al menos:

- policy/config
- queue/sync engine
- geofence runtime
- break flow
- check in/out flow
- selectors y formatters

Esta fase es delicada y debe hacerse despues de ordenar branding y auth.

## Fase 5. Extraer contratos reutilizables

Cuando el repo ya este limpio:

- identificar `core` exportable
- definir que modulos de `domains` podrian reutilizarse
- evaluar si conviene package compartido, repo base o monorepo

## 6. Regla de migracion

Cada refactor debe cumplir esto:

1. no romper rutas existentes
2. no cambiar comportamiento sin necesidad
3. mover una responsabilidad por vez
4. dejar imports mas claros que antes
5. terminar cada fase con build o chequeo de tipos

## 7. Primer sprint recomendado en ANIMA

Orden sugerido:

1. crear capa `brand/anima`
2. mover textos y constantes de marca
3. dejar `app.config.js` leyendo una fuente mas centralizada donde sea viable
4. extraer responsabilidades de `auth-context`
5. despues atacar `home.tsx`

## 8. Criterio para saber si vamos bien

Vamos bien si:

- la marca ANIMA ya no aparece dispersa por todo el repo
- `auth-context` deja de mezclar routing, cache, push y perfil en un solo archivo
- `home.tsx` baja fuerte de tamano y de responsabilidades
- nuevas features ya nacen dentro de `domains/*`
- la app sigue saliendo a produccion sin reescritura grande

## 9. Siguiente paso operativo

Primer refactor real recomendado:

- Fase 1 completa: crear `brand/anima` y centralizar branding/copy base

Despues:

- Fase 2 sobre `src/contexts/auth-context.tsx`

Ese orden da el mejor balance entre bajo riesgo, claridad arquitectonica y preparacion real para marca blanca.
