# Changelog — STOPMind!

Todos los cambios relevantes del proyecto se documentan en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

> **Guía rápida al preparar una nueva versión para App Store / Google Play:**
> 1. Mueve los puntos de `[Unreleased]` a una nueva sección `[X.Y.Z] - AAAA-MM-DD`.
> 2. Actualiza `expo.version` en `apps/mobile/app.json` para que coincida con `X.Y.Z`.
> 3. Usa el resumen de la versión como base para el campo *"Novedades de esta versión"* en App Store Connect.

---

## [Unreleased]

### Agregado
- **Avatares inclusivos sin fondo + selector de color de fondo personalizable (`apps/mobile/assets/avatars/`, `AvatarPickerModal`, `PlayerAvatar`, `playerStorage.ts`)**:
  - 16 ilustraciones 3D transparentes incluidas en la app cubriendo niños, niñas, jóvenes, adultos (con y sin barba/bigote), calvos (con y sin barba), mujeres de cabello corto/largo/rizos, abuelos y abuelas con diversidad de tonos de piel, y 12 colores de fondo a elección del jugador.
  - Guardado 100 % local en el dispositivo junto al apodo, selector con vista previa en vivo en Inicio y Unirse, y sincronización automática de personaje + color en salas **Wi-Fi local**, **Modo Online** y **Resultados / Podio final** (retrocompatible).

---

## [1.1.0] - 2026-11-22

### Novedades para usuarios *(listo para App Store / Google Play)*
```text
¡Ahora puedes jugar STOPMind! con tus amigos incluso a distancia! En esta versión mejoramos la forma de conectarte y hacemos cada partida aún más rápida:

• Nuevo Modo Online privado: crea una sala con código de 4 letras y juega con amigos aunque estén en otra ciudad, sin cuentas ni registros.
• Invita en un toque: comparte el código o enlace de tu sala directamente por WhatsApp, Mensajes o el QR en pantalla.
• Tu nombre siempre listo: ahora la app recuerda tu apodo en tu teléfono para que entres a jugar de inmediato cada vez que la abras.
• Cuéntanos qué te parece: incorporamos la opción para calificar STOPMind! directamente desde la app.
• Mejor conexión entre teléfonos en red Wi-Fi local y ajustes generales de diseño y fluidez.

¡Gracias por jugar STOPMind! Si te diviertes con la app, déjanos una reseña.
```

### Detalle técnico (Agregado)
- **Modo Online privado a distancia** (`apps/realtime` + `apps/mobile`):
  - Nuevo servicio en tiempo real (`apps/realtime`) sobre WebSockets cifrados (`WSS` / TLS 1.3) con salas privadas efímeras en memoria RAM, soporte para hasta 16 jugadores por sala, transferencia automática de anfitrión y validación inteligente de palabras reutilizando `@stopmind/shared`.
  - Selector **`Wi-Fi local` / `Online`** en la pantalla de configuración de partida (`setup.tsx`) y en la pestaña de código manual al unirse (`join.tsx`).
  - Botón nativo de **Compartir invitación** (`Share.share`) con enlace HTTPS clickable (`https://stopmind.cxvone.com/join?room=XXXX`) compatible con **Universal Links (iOS)**, **App Links (Android)** y página puente web de respaldo (`apps/web/join.html` + `/.well-known/apple-app-site-association`) para abrir STOPMind! directamente en la sala.
- **Persistencia local del nombre del jugador** (`apps/mobile/src/utils/playerStorage.ts`, `GameContext.tsx`):
  - El apodo del jugador se guarda **exclusivamente en el dispositivo** mediante `expo-file-system` (`Paths.document`, sin llamadas a APIs externas) y `localStorage` en web.
  - Se carga de manera síncrona al abrir la app para mostrar el nombre guardado desde el primer instante, tanto en la pantalla de inicio como al unirse a salas.
- **Solicitud nativa de reseña en tienda** (`expo-store-review`, `apps/mobile/src/utils/storeReview.ts`):
  - Usa la alerta oficial de iOS (`StoreKit`) y Android (*Play In-App Review*) al terminar la 2.ª partida completa (con pausa de 7 días entre solicitudes y sin filtrado de reseñas, 100 % compatible con políticas de Apple y Google).
  - Enlace directo **⭐ Calificar app** en el pie de la pantalla de inicio.
- **Soporte de red local Android para producción (iPhone ↔ Android)**:
  - Nuevo plugin de configuración Expo `apps/mobile/plugins/withAndroidLanNetwork.js` que configura `network_security_config.xml` y agrega los permisos `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` y `ACCESS_NETWORK_STATE`.
  - Adquisición y liberación automática de `WifiManager.MulticastLock` en `LanServerModule.kt` para descubrimiento confiable `_stopmind._tcp.` entre dispositivos Android y iOS.

### Corregido
- **Tabla de posiciones justa con desempate por STOP y ranking de competencia estándar (`packages/shared/src/scoring.ts`, `EmbeddedHostEngine.ts`, `apps/realtime/src/roomEngine.ts`, `results.tsx`)**: el anfitrión ya no gana empates por defecto; ante igualdad de puntos gana quien presionó STOP primero, y si ninguno presionó STOP ambos comparten posición (ej. `1, 1, 3` o `1, 1, 3, 4`), mostrando banner de empate en resultados finales cuando corresponde.
- **Creación/unión de salas Online y enlaces `stopmind://` en iOS/Android (`apps/mobile/src/utils/security.ts`, `apps/realtime/src/index.ts`)**: sustituido `new URL()` por `parseStrictUrl()` compatible con React Native/Hermes y habilitado `Origin` del mismo origen en `apps/realtime` para el handshake nativo WebSocket de iOS (manteniendo el bloqueo CSWSH contra orígenes de terceros).
- **Detección de respuestas repetidas (`packages/shared/src/scoring.ts`)**: corregidos falsos positivos por similitud laxa de 1–2 letras entre palabras, nombres o apellidos distintos (ej. *Frías* vs *Farías*, *María* vs *Mario*, *Daniel* vs *Daniela*, *Perro* vs *Pero*), conservando la detección exacta por tildes, equivalentes fonéticos en español (*Gómez*/*Gomes*, *Jirafa*/*Girafa*) y trasposiciones accidentales en palabras largas.

### Seguridad y Resiliencia
- **Recuperación segura global (`AppErrorBoundary`)**: pantalla de recuperación amigable con código de correlación opaco (`SM-XXXX-XXXX`), sin exponer trazas ni rutas internas, y hook `setCrashReporter()` listo para conectar Sentry o Crashlytics.
- **Whitelist estricta en Deep Links, QR y WebSockets** (`apps/mobile/src/utils/security.ts`, `network.ts`, `GameContext.tsx`): valida esquema, dominio oficial o IP privada LAN (bloqueando hosts de terceros, `ws://` públicos e IPs de metadatos en nube).
- **Validación de esquemas y cotas anti-DoS**:
  - `BoundedMap` (máx. 500 entradas) y validación/sanitización de salidas en `apiValidator.ts`, además de exigir `https://` en endpoints públicos.
  - `EmbeddedHostEngine.ts`: tope de `16 KB` por mensaje, máximo `12` jugadores, saneamiento de `answers` contra contaminación de prototipos y error opaco sin revelar el código de sala.
  - `GameContext.tsx`: validación en tiempo de ejecución de `RoomSnapshot` y `RoundResults` antes de renderizar.
  - `apps/realtime`: validación de cabecera `Origin` (mitigación CSWSH) y límite de tamaño de frame WebSocket en el borde.
- **Hardening Android y Cadena de Suministro**: `android:allowBackup="false"`, pruebas unitarias de seguridad en `apps/mobile` y scripts `security:audit` / `security:sbom`.


### Cambiado
- **Privacidad y textos visibles sin exposición de proveedores**:
  - Política de Privacidad (`https://stopmind.cxvone.com/app-privacy`, ES/EN) actualizada para cubrir las salas Online privadas efímeras y redactada de forma agnóstica a proveedores externos.
  - Etiqueta de resultados actualizada de `✨ IA Gemini` a **`✨ Revisión IA`** y textos de estado simplificados en la app.

### Corregido
- **Landing web (`https://stopmind.cxvone.com`)**:
  - Se limpió la barra de estado y la *Dynamic Island* (`9:41`) en las capturas promocionales (`screen-splash.png`, `screen-home.png`, `screen-play.png`).
  - Se actualizó el correo de soporte y ajustes visuales de contraste en `apps/web/index.html`.

---

## [1.0.0] - 2026-11-21

### Novedades para usuarios *(listo para App Store / Google Play)*
```text
¡Bienvenido a STOPMind!, el clásico juego de palabras (STOP, Basta y Tutti Frutti) pensado para jugar con amigos y familia desde tu teléfono:

• Juega en grupo por Wi-Fi sin necesidad de internet: crea una sala, muestra el código QR y todos entran en segundos.
• Personaliza tu partida: elige categorías, tiempo, rondas, letras sin repetir y activa el botón de ayuda si quieres un reto distinto.
• Puntuación automática y justa: 100 puntos por palabra única, 50 si coincide con otro jugador y revisión inteligente opcional.
• Sin cuentas, sin contraseñas y sin anuncios invasivos.
```

### Lanzamiento inicial a producción
- **Arquitectura Monorepo Nx**:
  - `packages/shared`: lógica compartida de puntuación (`100 / 50 / 0`), validador local insensible a tildes y errores leves, y mazo Fisher-Yates de letras sin repeticiones entre partidas consecutivas.
  - `apps/mobile`: app móvil iOS y Android con Expo SDK 58, React Native 0.88.1 y Expo Router.
  - `apps/api`: backend serverless HTTPS para validación inteligente opcional de palabras y ayudas, con caché temporal y protección anti-abuso.
  - `apps/web`: landing promocional (`https://stopmind.cxvone.com`) y Política de Privacidad pública (`https://stopmind.cxvone.com/app-privacy`).
- **Multijugador Wi-Fi local sin internet**:
  - Servidor WebSocket embebido en el teléfono anfitrión (`LanServer` nativo en Swift `Network.framework` y Kotlin `ServerSocket`), descubrimiento automático Bonjour/NSD (`_stopmind._tcp`), invitación por código QR y código manual de 4 caracteres.
- **Experiencia de juego y diseño**:
  - Splash screen animado con Lottie (categorías → lluvia de palabras → desenfoque nativo → mano **STOP**) y pantalla principal con fondo difuminado de palabras y botón **JUGAR** adaptable al teclado en dispositivos pequeños (iPhone SE / iPhone 12).
  - Categorías clásicas, extras y personalizadas, selección de las 27 letras del español, temporizador sincronizado, rondas configurables y botón de ayuda con penalización personalizable (puntos, bloqueo o ambas).
  - Sistema centralizado de tokens de diseño en `apps/mobile/src/theme/tokens.ts`.
  - Preparación completa para App Store Connect: ícono opaco `1024×1024`, capturas (`1206×2622`), encabezados (`3840×1646`), cumplimiento de encriptación exenta (`ITSAppUsesNonExemptEncryption: false`) y textos ASO en español.
