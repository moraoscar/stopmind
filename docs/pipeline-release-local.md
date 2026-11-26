# Pipeline Local de Release — STOPMind! (macOS)

Genera los binarios firmados de **Android (`.apk` + `.aab`)** y compila + sube **iOS (`.ipa`)** directo a **App Store Connect / TestFlight** con un solo comando desde tu Mac, sin abrir Xcode ni Android Studio.

---

## Configuración única (~3 minutos)

### 1. Crear el archivo de credenciales local (no se sube a Git)
```bash
cp .env.release.example .env.release.local
```

### 2. Obtener la App Store Connect API Key (`.p8`) para iOS
1. Entra a [App Store Connect](https://appstoreconnect.apple.com) → **Usuarios y acceso** → pestaña **Integraciones** → **API de App Store Connect**.
2. Pulsa **+** (*Generar clave de API*):
   - **Nombre**: `STOPMind Local Release`
   - **Acceso**: `Administrador` o `App Manager`
3. Copia estos 3 valores en `.env.release.local`:
   - **ID de emisor (Issuer ID)** → `ASC_API_ISSUER_ID`
   - **ID de clave (Key ID)** → `ASC_API_KEY_ID`
   - Descarga el archivo `AuthKey_XXXXXXXXXX.p8` (Apple solo deja descargarlo **una vez**), guárdalo en `~/.appstoreconnect/private_keys/` y coloca su ruta en `ASC_API_KEY_PATH`.
4. `IOS_TEAM_ID` ya viene prellenado con tu equipo (`3NPWZ6L7JU`).

### 3. Configurar tu Keystore de Android
En `.env.release.local`, coloca la ruta y contraseñas del mismo archivo `.jks` / `.keystore` con el que firmaste tu versión anterior en Android Studio:
- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### 4. Validar que todo esté bien (sin compilar todavía)
```bash
npm run release:mobile:dry
```

---

## Comandos de uso diario

| Comando | Qué hace |
| --- | --- |
| `npm run release:mobile` | Corre lint/typecheck/tests, sincroniza nativos, genera **APK + AAB** firmados y compila + sube **iOS a App Store Connect** |
| `npm run release:mobile -- --bump-build` | Igual al anterior, pero **sube automáticamente +1** el `ios.buildNumber` y `android.versionCode` en `apps/mobile/app.json` |
| `npm run release:android` | Solo genera **APK + AAB** de Android |
| `npm run release:android -- --apk-only` | Solo genera el **APK** para instalar y probar rápido en un teléfono |
| `npm run release:ios` | Solo compila iOS y sube a **App Store Connect / TestFlight** |
| `npm run release:ios -- --no-upload` | Solo genera el `.ipa` localmente sin subirlo a Apple |
| `npm run release:mobile:dry` | Verifica credenciales, rutas, versión y herramientas sin compilar |

### Dónde quedan los archivos generados
Todos los binarios se guardan en la carpeta local `releases/v<version>-ios<build>-and<code/>` (ignorada por Git):
- `STOPMind-vX.Y.Z-bN.apk` → para instalar directo en teléfonos Android.
- `STOPMind-vX.Y.Z-bN.aab` → para subir a Google Play Console.
- `STOPMind-vX.Y.Z-bN.ipa` → binario subido automáticamente a App Store Connect.
