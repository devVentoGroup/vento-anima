# Estructura - ANIMA Mobile

Este documento describe la estructura de carpetas y archivos clave de la app Expo ubicada en `apps/anima-mobile`.

## Arbol (alto nivel)

```
apps/anima-mobile/
├─ app/                     # Rutas Expo Router
│  ├─ (auth)/               # Flujo de autenticacion
│  │  ├─ _layout.tsx
│  │  ├─ login.tsx
│  │  └─ splash.tsx
│  ├─ (app)/                # Flujo autenticado
│  │  ├─ _layout.tsx
│  │  └─ home.tsx
│  ├─ _layout.tsx           # Root layout (providers + stack)
│  └─ index.tsx             # Redirect inicial
├─ assets/                  # Imagenes, iconos, splash
├─ components/              # Componentes compartidos
├─ constants/               # Constantes (e.g. colores)
├─ contexts/                # Contextos globales (auth)
├─ hooks/                   # Hooks (asistencia, etc.)
├─ lib/                     # Integraciones (Supabase, etc.)
├─ docs/                    # Documentacion local de la app
├─ app.json                 # Configuracion Expo
├─ babel.config.js
├─ eas.json
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Notas
- `app/` usa Expo Router con grupos `(auth)` y `(app)`.
- `contexts/auth-context.tsx` controla sesion, employee y routing.
- `hooks/use-attendance.ts` concentra la logica de check-in/out.
