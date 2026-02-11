# Versionado ANIMA (1.0.2+)

## Cómo está configurado

- **version** (ej. `1.0.2`): lo que ve el usuario. Súbelo cuando hagas una entrega que quieras identificar (ej. 1.0.2 → 1.0.3).
- **iOS buildNumber** (ej. `"5"`): número interno que pide App Store / TestFlight. Cada build que subas debe tener un número **mayor** que el último aceptado.
- **Android versionCode** (ej. `6`): lo mismo en Google Play. Cada AAB debe tener un **versionCode mayor** que el último que tengas en Play (si no, te dirá que el código es anterior).

En **eas.json** está `"autoIncrement": false`. Así EAS usa exactamente los números que pones en **app.config.js** y no los cambia por ti.

## Cuando vayas a subir un nuevo build

1. Abre **app.config.js**.
2. Si quieres cambiar la versión visible: actualiza `version` (ej. a `"1.0.3"`).
3. **iOS:** sube `ios.buildNumber` al siguiente número (ej. de `"5"` a `"6"`).
4. **Android:** sube `android.versionCode` al siguiente número (ej. de `6` a `7`). Si Play te rechazó por “código anterior”, pon un número **mayor** que el último que tengas en la consola de Play.
5. Guarda, haz commit y lanza el build.

## Regla para Android

- En Google Play Console, el último **versionCode** que hayas subido (o que esté en “Producción” / “Pruebas”) es tu referencia.
- En **app.config.js**, `android.versionCode` debe ser **estrictamente mayor** que ese número. Si el último en Play es 6, pon 7 (o más).

Así evitas el error de “ese código es anterior” y mantienes el control desde el repo.
