# Prompt para arrancar iOS / App Store

Pegar esto en una sesión nueva de Claude Code, corriendo en la carpeta raíz
de este repo (`agrosistema/`) en la Mac.

---

Quiero que me ayudes a publicar AGAR (el sistema web de gestión agropecuaria
de este repo, en `apps/web`) como app de iOS en el App Store. Ya está
publicado del lado de Android (Play Store, en proceso de prueba cerrada) y
quiero replicar exactamente el mismo enfoque para iOS.

## Contexto de lo que ya está hecho (en Windows, lado Android)

Leé `CONTEXTO_CLAUDE_CODE.md` para el contexto general del proyecto. Además,
específicamente sobre la app nativa:

- La app nativa es un **wrapper de Capacitor** sobre el sitio en producción
  (`https://www.agar.ar`), NO un build estático — la app es básicamente un
  WebView que carga el sitio real. Esto es así porque el sitio usa Next.js
  con SSR, cookies de sesión y Server Actions, que no se pueden exportar como
  HTML estático.
- Config en `apps/web/capacitor.config.ts`:
  - `appId: 'ar.agar.sistema'` — **usar el mismo Bundle ID en iOS**, así
    queda consistente entre plataformas (no hay riesgo de colisión, son
    namespaces independientes, pero conviene que sea igual).
  - `appName: 'AGAR'`
  - `server.url: 'https://www.agar.ar'` con `allowNavigation` para
    `agar.ar` / `www.agar.ar` / `*.agar.ar`.
  - `webDir: 'www'` — es solo un placeholder (`apps/web/www/index.html`),
    nunca se ve porque `server.url` carga el sitio remoto directamente.
- **`apps/web/android/` y `apps/web/ios/` están en `.gitignore`** (raíz del
  repo) a propósito — el usuario no quiere subir las carpetas nativas a
  GitHub. Esto ya está configurado, no lo cambies. Cualquier edición manual
  dentro de esas carpetas (Info.plist, permisos, etc.) no se versiona, así
  que si hay que regenerar la carpeta (`npx cap add ios` de nuevo) hay que
  volver a aplicar esos cambios manuales.
- Ya están instalados en `apps/web/package.json`: `@capacitor/core`,
  `@capacitor/cli`, `@capacitor/android` (agregar ahora `@capacitor/ios`),
  y `@capacitor/push-notifications`.
- **Notificaciones push:** ya está la conexión completa del lado del código
  y de la base de datos:
  - Tabla `push_tokens` en Supabase (migración `028_push_tokens.sql`, ya
    aplicada en producción) — guarda `usuario_id`, `token`, `plataforma`,
    con RLS (cada usuario solo ve su propio token).
  - Componente `apps/web/src/components/push-notifications-init.tsx`
    (montado en `app-shell.tsx`): pide permiso, llama
    `PushNotifications.register()`, y al recibir el evento `registration`
    guarda el token en `push_tokens`. Este código es multiplataforma — ya
    funciona para iOS sin tocarlo, Capacitor lo resuelve automáticamente.
  - **Falta exclusivamente la config nativa de iOS**: agregar la app iOS al
    mismo proyecto de Firebase (`agar-6e90a`), descargar
    `GoogleService-Info.plist`, agregarlo al proyecto de Xcode, subir la
    clave APNs a Firebase Console (Project Settings → Cloud Messaging →
    Apple app configuration), y habilitar la capability "Push
    Notifications" + "Background Modes → Remote notifications" en Xcode.
  - El envío real de notificaciones (componer y disparar un push) todavía
    NO está implementado a propósito — es solo la conexión, para agregar
    el envío a futuro.
- **Permiso de cámara**: la app usa `html5-qrcode` para escanear códigos en
  remitos/stock. En Android se agregó `CAMERA` al manifest. En iOS hace
  falta `NSCameraUsageDescription` en `Info.plist` (sin esto, Apple rechaza
  la app automáticamente en revisión) — algo como: "AGAR usa la cámara para
  escanear códigos QR y de barras en remitos y stock."
- **Logo**: `apps/web/public/agar-final.png` — ya verificado que es PNG
  truecolor SIN canal alfa (sin transparencia), así que es válido tal cual
  para el ícono de App Store (Apple rechaza íconos con transparencia).
- **Firma de Android**: hay un keystore de release en
  `apps/web/android/app/agar-release.keystore` (fuera de git). Para iOS el
  esquema de firma es totalmente distinto (certificados + perfiles de
  aprovisionamiento de Apple Developer), no aplica nada de esto.
- **Páginas públicas ya creadas y en producción** (reutilizar las mismas
  URLs para App Store Connect, no crear nada nuevo):
  - Política de privacidad: `https://www.agar.ar/privacidad`
  - Eliminación de cuenta: `https://www.agar.ar/eliminar-cuenta`
- Cuenta de prueba para revisores (mismo concepto que el "Detalles de
  acceso" de Play Console — Apple pide credenciales de demo en App Store
  Connect → App Review Information): podés reusar la cuenta demo que ya
  existe (`googleplay.reviewer@agar.ar`, empresa "Demo Google Play",
  aislada con datos de ejemplo) o generar una nueva con
  `apps/web/scripts/create-demo-reviewer.mjs` como referencia.

## Qué necesito que hagas en esta sesión

1. Confirmá que tenés Xcode, CocoaPods y una cuenta de Apple Developer
   Program activa (de pago, USD 99/año) — si algo de eso falta, decímelo
   antes de seguir, son pasos que tengo que hacer yo en el navegador/Mac.
2. `cd apps/web && npm install @capacitor/ios@7.6.6 --save-exact` (mismo
   major/minor que el resto de los paquetes de Capacitor, ya en 7.6.6) y
   `npx cap add ios`.
3. Agregar `NSCameraUsageDescription` al `Info.plist` generado.
4. Instalar `@capacitor/push-notifications` ya está en package.json — solo
   falta correr `npx cap sync ios` para que se integre al proyecto de Xcode.
5. Guiame paso a paso para:
   - Crear el App ID en Apple Developer Portal con el Bundle ID
     `ar.agar.sistema`.
   - Agregar la app iOS al proyecto de Firebase existente y conseguir
     `GoogleService-Info.plist`.
   - Subir la clave/certificado APNs a Firebase.
   - Configurar firma automática en Xcode con mi cuenta de Apple Developer.
   - Generar el ícono de la app en los tamaños que pide iOS a partir de
     `agar-final.png`.
6. Armar el build de archivo (`.ipa`) y subirlo a App Store Connect (vía
   Xcode Organizer o Transporter).
7. Ayudarme a completar en App Store Connect: ficha de la app, cuestionario
   de privacidad ("App Privacy" / nutrition label — equivalente al Data
   Safety de Play Console, mismo análisis de datos que ya hicimos para
   Android: email, ID de usuario, archivos/documentos PDF compartidos con
   Anthropic para OCR; nada de ubicación porque es efímera y nunca sale del
   dispositivo), información de contacto, URLs de privacidad/eliminación de
   cuenta (ya las tengo, arriba), y credenciales de la cuenta demo para el
   equipo de revisión.
8. Configurar TestFlight para testing antes de mandar a revisión completa.

Importante: como en la sesión de Windows, vos hacés los pasos de cuenta/
consola (Apple Developer Portal, App Store Connect, Firebase Console) en el
navegador y me vas pegando lo que haga falta (Bundle ID confirmado,
contenido de `GoogleService-Info.plist`, etc.); yo me encargo del código,
la config de Xcode/Capacitor y los builds.
