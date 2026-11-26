#!/usr/bin/env node
/**
 * STOPMind! — Local Release Pipeline (macOS)
 * ------------------------------------------
 * Runs quality checks, syncs native projects from apps/mobile/app.json,
 * generates signed Android artifacts (.apk + .aab), archives & exports iOS (.ipa),
 * and uploads the iOS build to App Store Connect / TestFlight.
 *
 * Usage:
 *   npm run release:mobile
 *   npm run release:mobile -- --bump-build
 *   npm run release:mobile -- --dry-run
 *   npm run release:android
 *   npm run release:ios
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MOBILE_DIR = path.join(ROOT_DIR, 'apps', 'mobile');
const ANDROID_DIR = path.join(MOBILE_DIR, 'android');
const IOS_DIR = path.join(MOBILE_DIR, 'ios');
const APP_JSON_PATH = path.join(MOBILE_DIR, 'app.json');
const ENV_LOCAL_PATH = path.join(ROOT_DIR, '.env.release.local');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');

const IOS_WORKSPACE = path.join(IOS_DIR, 'StopMind.xcworkspace');
const IOS_SCHEME = 'StopMind';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function logInfo(msg) {
  console.log(`${ANSI.cyan}▸${ANSI.reset} ${msg}`);
}
function logOk(msg) {
  console.log(`${ANSI.green}✔${ANSI.reset} ${msg}`);
}
function logWarn(msg) {
  console.log(`${ANSI.yellow}⚠${ANSI.reset} ${msg}`);
}
function logErr(msg) {
  console.error(`${ANSI.red}✖${ANSI.reset} ${msg}`);
}
function logSection(title) {
  console.log(
    `\n${ANSI.bold}${ANSI.cyan}══ ${title} ══${ANSI.reset}`
  );
}

function printHelp() {
  console.log(`
${ANSI.bold}STOPMind! Local Release Pipeline${ANSI.reset}

Uso:
  node scripts/release-mobile.mjs [opciones]

Opciones:
  --dry-run        Valida credenciales, versiones y herramientas sin compilar ni subir
  --bump-build     Incrementa automáticamente ios.buildNumber y android.versionCode (+1)
  --android-only   Solo genera Android (.apk y .aab)
  --ios-only       Solo compila y sube iOS a App Store Connect
  --apk-only       En Android, genera únicamente .apk (omite .aab)
  --no-upload      En iOS, genera el .ipa local pero NO lo sube a App Store Connect
  --skip-checks    Omite lint, typecheck y tests
  --skip-prebuild  Omite 'npx expo prebuild --no-install'
  --pods           Fuerza 'pod install' antes de compilar iOS
  --help, -h       Muestra esta ayuda
`);
}

function parseArgs(argv) {
  const flags = new Set(argv);
  if (flags.has('--help') || flags.has('-h')) {
    printHelp();
    process.exit(0);
  }
  const androidOnly = flags.has('--android-only');
  const iosOnly = flags.has('--ios-only');
  if (androidOnly && iosOnly) {
    logErr('No puedes combinar --android-only y --ios-only al mismo tiempo.');
    process.exit(1);
  }
  return {
    dryRun: flags.has('--dry-run'),
    bumpBuild: flags.has('--bump-build'),
    runAndroid: !iosOnly,
    runIos: !androidOnly,
    apkOnly: flags.has('--apk-only'),
    uploadIos: !flags.has('--no-upload'),
    skipChecks: flags.has('--skip-checks'),
    skipPrebuild: flags.has('--skip-prebuild'),
    runPods: flags.has('--pods'),
  };
}

function expandHome(rawPath) {
  if (!rawPath) return '';
  if (rawPath === '~') return os.homedir();
  if (rawPath.startsWith('~/')) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return path.resolve(ROOT_DIR, rawPath);
}

function loadEnvFile(filePath) {
  const loaded = {};
  if (!fs.existsSync(filePath)) return loaded;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) loaded[key] = val;
  }
  return loaded;
}

function getEnv(envMap, key, fallback = '') {
  return (process.env[key] ?? envMap[key] ?? fallback).trim();
}

function resolveAndroidSdkDir(envMap) {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    envMap.ANDROID_HOME,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = expandHome(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return '';
}

function buildExecEnv(extraEnv = {}) {
  const nodeBinDir = path.dirname(process.execPath);
  const currentPath = process.env.PATH || '';
  const pathParts = currentPath.split(path.delimiter);
  const mergedPath = pathParts.includes(nodeBinDir)
    ? currentPath
    : `${nodeBinDir}${path.delimiter}${currentPath}`;
  return {
    ...process.env,
    PATH: mergedPath,
    LANG: process.env.LANG || 'en_US.UTF-8',
    NX_TUI: 'false',
    ...extraEnv,
  };
}

function runStep(cmd, args, options = {}) {
  const { cwd = ROOT_DIR, displayArgs = args, env = buildExecEnv() } = options;
  logInfo(`$ ${cmd} ${displayArgs.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (res.error) {
    throw new Error(`No se pudo ejecutar "${cmd}": ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`El comando "${cmd}" falló con código ${res.status}.`);
  }
}

function commandExists(cmd) {
  const res = spawnSync('which', [cmd], {
    env: buildExecEnv(),
    stdio: 'ignore',
  });
  return res.status === 0;
}

function readAppJson() {
  return JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
}

function bumpBuildNumbersInAppJson(opts) {
  const appJson = readAppJson();
  const changes = [];

  if (opts.runIos) {
    const prevIosBuild = Number.parseInt(appJson.expo.ios?.buildNumber ?? '1', 10);
    const nextIosBuild = String((Number.isFinite(prevIosBuild) ? prevIosBuild : 1) + 1);
    appJson.expo.ios.buildNumber = nextIosBuild;
    changes.push(`ios.buildNumber ${prevIosBuild} → ${nextIosBuild}`);
  }

  if (opts.runAndroid) {
    const prevAndroidCode = Number.parseInt(
      String(appJson.expo.android?.versionCode ?? 1),
      10
    );
    const nextAndroidCode = (Number.isFinite(prevAndroidCode) ? prevAndroidCode : 1) + 1;
    appJson.expo.android.versionCode = nextAndroidCode;
    changes.push(`android.versionCode ${prevAndroidCode} → ${nextAndroidCode}`);
  }

  fs.writeFileSync(APP_JSON_PATH, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8');
  logOk(`app.json actualizado (misma versión ${appJson.expo.version}): ${changes.join(', ')}`);
  return appJson;
}

function formatFileSummary(filePath) {
  const stat = fs.statSync(filePath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')
    .slice(0, 12);
  return `${path.relative(ROOT_DIR, filePath)} (${sizeMb} MB · sha256:${hash})`;
}

function buildExportOptionsPlist(teamId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`;
}

function validateConfig(opts, envMap) {
  const errors = [];

  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    logWarn(
      `No se encontró .env.release.local. Copia .env.release.example -> .env.release.local y llena tus credenciales.`
    );
  }

  const android = {
    sdkDir: resolveAndroidSdkDir(envMap),
    keystorePath: expandHome(getEnv(envMap, 'ANDROID_KEYSTORE_PATH')),
    keystorePassword: getEnv(envMap, 'ANDROID_KEYSTORE_PASSWORD'),
    keyAlias: getEnv(envMap, 'ANDROID_KEY_ALIAS'),
    keyPassword: getEnv(envMap, 'ANDROID_KEY_PASSWORD'),
  };

  const ios = {
    teamId: getEnv(envMap, 'IOS_TEAM_ID', '3NPWZ6L7JU'),
    apiKeyId: getEnv(envMap, 'ASC_API_KEY_ID'),
    apiIssuerId: getEnv(envMap, 'ASC_API_ISSUER_ID'),
    apiKeyPath: expandHome(getEnv(envMap, 'ASC_API_KEY_PATH')),
  };

  if (opts.runAndroid) {
    if (!commandExists('java')) {
      errors.push('Java (JDK) no está instalado o no está en PATH.');
    }
    if (!android.sdkDir) {
      errors.push(
        'No se encontró el Android SDK. Instala Android Studio o define ANDROID_HOME en .env.release.local.'
      );
    }
    if (!fs.existsSync(path.join(ANDROID_DIR, 'gradlew'))) {
      errors.push(`No se encontró gradlew en ${ANDROID_DIR}.`);
    }
    if (!android.keystorePath) {
      errors.push('Falta ANDROID_KEYSTORE_PATH en .env.release.local.');
    } else if (!fs.existsSync(android.keystorePath)) {
      errors.push(`No existe el keystore de Android en: ${android.keystorePath}`);
    }
    if (!android.keystorePassword) {
      errors.push('Falta ANDROID_KEYSTORE_PASSWORD en .env.release.local.');
    }
    if (!android.keyAlias) {
      errors.push('Falta ANDROID_KEY_ALIAS en .env.release.local.');
    }
    if (!android.keyPassword) {
      errors.push('Falta ANDROID_KEY_PASSWORD en .env.release.local.');
    }
    if (
      android.keystorePath &&
      fs.existsSync(android.keystorePath) &&
      android.keystorePassword &&
      android.keyAlias &&
      commandExists('keytool')
    ) {
      const checkAlias = spawnSync(
        'keytool',
        [
          '-list',
          '-keystore',
          android.keystorePath,
          '-storepass',
          android.keystorePassword,
          '-alias',
          android.keyAlias,
        ],
        { env: buildExecEnv(), stdio: 'pipe', encoding: 'utf8' }
      );
      if (checkAlias.status !== 0) {
        const detail = (checkAlias.stdout || checkAlias.stderr || '').trim().split('\n')[0];
        errors.push(
          `El alias '${android.keyAlias}' o la contraseña no coinciden con el keystore (${detail || 'error de keytool'}).`
        );
      }
    }
  }

  if (opts.runIos) {
    if (process.platform !== 'darwin') {
      errors.push('La compilación de iOS solo puede ejecutarse en macOS.');
    }
    if (!commandExists('xcodebuild') || !commandExists('xcrun')) {
      errors.push('Xcode Command Line Tools (xcodebuild/xcrun) no están disponibles.');
    }
    if (!fs.existsSync(IOS_WORKSPACE) && !commandExists('pod')) {
      errors.push(
        `No se encontró ${IOS_WORKSPACE} y CocoaPods ('pod') no está instalado para generarlo.`
      );
    }
    if (!ios.teamId) {
      errors.push('Falta IOS_TEAM_ID en .env.release.local.');
    }
    if (!ios.apiKeyId) {
      errors.push('Falta ASC_API_KEY_ID en .env.release.local.');
    }
    if (!ios.apiIssuerId) {
      errors.push('Falta ASC_API_ISSUER_ID en .env.release.local.');
    }
    if (!ios.apiKeyPath) {
      errors.push('Falta ASC_API_KEY_PATH en .env.release.local.');
    } else if (!fs.existsSync(ios.apiKeyPath)) {
      errors.push(`No existe la llave .p8 de App Store Connect en: ${ios.apiKeyPath}`);
    }
  }

  return { errors, android, ios };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const envMap = loadEnvFile(ENV_LOCAL_PATH);

  logSection('1. Preflight & Configuración');

  let appJson = readAppJson();
  if (opts.bumpBuild && !opts.dryRun) {
    appJson = bumpBuildNumbersInAppJson(opts);
  } else if (opts.bumpBuild && opts.dryRun) {
    const targets = [
      opts.runIos ? 'ios.buildNumber' : null,
      opts.runAndroid ? 'android.versionCode' : null,
    ].filter(Boolean);
    logInfo(`[dry-run] Se incrementarían (+1) manteniendo versión ${appJson.expo.version}: ${targets.join(', ')}.`);
  }

  const version = appJson.expo.version;
  const iosBuild = appJson.expo.ios?.buildNumber ?? '1';
  const androidVersionCode = appJson.expo.android?.versionCode ?? 1;

  logInfo(`App: ${appJson.expo.name} (${appJson.expo.ios?.bundleIdentifier})`);
  logInfo(
    `Versión: ${ANSI.bold}${version}${ANSI.reset} · iOS buildNumber: ${ANSI.bold}${iosBuild}${ANSI.reset} · Android versionCode: ${ANSI.bold}${androidVersionCode}${ANSI.reset}`
  );
  logInfo(
    `Objetivos: ${[
      opts.runAndroid ? (opts.apkOnly ? 'Android (APK)' : 'Android (APK + AAB)') : null,
      opts.runIos
        ? opts.uploadIos
          ? 'iOS (IPA + Subir a App Store Connect)'
          : 'iOS (IPA local)'
        : null,
    ]
      .filter(Boolean)
      .join('  +  ')}`
  );

  const { errors, android, ios } = validateConfig(opts, envMap);
  if (errors.length > 0) {
    console.log('');
    for (const err of errors) {
      logErr(err);
    }
    console.log('');
    logInfo(
      'Consulta docs/pipeline-release-local.md para configurar .env.release.local (toma ~3 min una sola vez).'
    );
    process.exit(1);
  }
  logOk('Credenciales, archivos de firma y herramientas nativas verificados.');

  const releaseFolderName = `v${version}-ios${iosBuild}-and${androidVersionCode}`;
  const outDir = path.join(RELEASES_DIR, releaseFolderName);

  if (opts.dryRun) {
    logSection('Dry-Run Completado');
    logOk(`Todo listo para compilar en ${path.relative(ROOT_DIR, outDir)}/`);
    logInfo('Pasos que se ejecutarían:');
    if (!opts.skipChecks) logInfo('  • Lint + Typecheck + Tests (Nx)');
    if (!opts.skipPrebuild) logInfo('  • npx expo prebuild --no-install (sincronizar versiones)');
    if (opts.runAndroid) {
      logInfo(
        `  • Gradle ${opts.apkOnly ? 'assembleRelease' : 'assembleRelease bundleRelease'} firmado con ${path.basename(android.keystorePath)}`
      );
    }
    if (opts.runIos) {
      logInfo(`  • xcodebuild archive + exportArchive (Team ${ios.teamId})`);
      if (opts.uploadIos) {
        logInfo(`  • xcrun altool --upload-app (Key ID ${ios.apiKeyId})`);
      }
    }
    process.exit(0);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const generatedFiles = [];

  // 2. Quality checks
  if (!opts.skipChecks) {
    logSection('2. Validación de Código (Lint, Typecheck y Tests)');
    runStep('npx', ['nx', 'run', 'mobile:lint']);
    runStep('npx', ['nx', 'run-many', '-t', 'typecheck']);
    runStep('npx', ['nx', 'run-many', '-t', 'test']);
    logOk('Lint, typecheck y tests aprobados.');
  }

  // 3. Sync native projects with app.json
  if (!opts.skipPrebuild) {
    logSection('3. Sincronizando Proyectos Nativos (Expo Prebuild)');
    const platforms =
      opts.runAndroid && opts.runIos
        ? []
        : opts.runAndroid
          ? ['--platform', 'android']
          : ['--platform', 'ios'];
    runStep('npx', ['expo', 'prebuild', '--no-install', ...platforms], {
      cwd: MOBILE_DIR,
    });
    logOk('Proyectos nativos sincronizados con apps/mobile/app.json.');
  }

  // 4. Android Build (Signed APK + AAB)
  if (opts.runAndroid) {
    logSection('4. Compilando Android Release Firmado');

    // Ensure local.properties points to the detected Android SDK (expo prebuild can omit it)
    const localPropsPath = path.join(ANDROID_DIR, 'local.properties');
    if (!fs.existsSync(localPropsPath) && android.sdkDir) {
      fs.writeFileSync(localPropsPath, `sdk.dir=${android.sdkDir}\n`, 'utf8');
      logInfo(`Generado android/local.properties → ${android.sdkDir}`);
    }

    const gradleTasks = opts.apkOnly
      ? ['assembleRelease']
      : ['assembleRelease', 'bundleRelease'];

    const signingArgs = [
      `-Pandroid.injected.signing.store.file=${android.keystorePath}`,
      `-Pandroid.injected.signing.store.password=${android.keystorePassword}`,
      `-Pandroid.injected.signing.key.alias=${android.keyAlias}`,
      `-Pandroid.injected.signing.key.password=${android.keyPassword}`,
    ];
    const maskedSigningArgs = [
      `-Pandroid.injected.signing.store.file=${path.basename(android.keystorePath)}`,
      '-Pandroid.injected.signing.store.password=***',
      `-Pandroid.injected.signing.key.alias=${android.keyAlias}`,
      '-Pandroid.injected.signing.key.password=***',
    ];

    runStep('./gradlew', [...gradleTasks, ...signingArgs], {
      cwd: ANDROID_DIR,
      displayArgs: [...gradleTasks, ...maskedSigningArgs],
      env: buildExecEnv({
        ANDROID_HOME: android.sdkDir,
        ANDROID_SDK_ROOT: android.sdkDir,
      }),
    });

    const apkSrc = path.join(
      ANDROID_DIR,
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk'
    );
    const apkDest = path.join(
      outDir,
      `STOPMind-v${version}-b${androidVersionCode}.apk`
    );
    if (!fs.existsSync(apkSrc)) {
      throw new Error(`No se encontró el APK generado en ${apkSrc}`);
    }
    fs.copyFileSync(apkSrc, apkDest);
    generatedFiles.push(apkDest);
    logOk(`APK generado: ${formatFileSummary(apkDest)}`);

    if (!opts.apkOnly) {
      const aabSrc = path.join(
        ANDROID_DIR,
        'app',
        'build',
        'outputs',
        'bundle',
        'release',
        'app-release.aab'
      );
      const aabDest = path.join(
        outDir,
        `STOPMind-v${version}-b${androidVersionCode}.aab`
      );
      if (!fs.existsSync(aabSrc)) {
        throw new Error(`No se encontró el AAB generado en ${aabSrc}`);
      }
      fs.copyFileSync(aabSrc, aabDest);
      generatedFiles.push(aabDest);
      logOk(`AAB generado (Google Play): ${formatFileSummary(aabDest)}`);
    }
  }

  // 5. iOS Build & Upload to App Store Connect
  if (opts.runIos) {
    logSection('5. Compilando y Exportando iOS (.ipa)');

    if (
      opts.runPods ||
      !fs.existsSync(IOS_WORKSPACE) ||
      !fs.existsSync(path.join(IOS_DIR, 'Pods'))
    ) {
      logInfo('Instalando CocoaPods para generar StopMind.xcworkspace...');
      runStep('pod', ['install'], { cwd: IOS_DIR });
    }

    const archivePath = path.join(outDir, `StopMind-v${version}-b${iosBuild}.xcarchive`);
    const exportDir = path.join(outDir, 'ios-export');
    const exportPlistPath = path.join(outDir, 'ExportOptions.plist');

    fs.rmSync(archivePath, { recursive: true, force: true });
    fs.rmSync(exportDir, { recursive: true, force: true });
    fs.writeFileSync(exportPlistPath, buildExportOptionsPlist(ios.teamId), 'utf8');

    const authArgs = [
      '-allowProvisioningUpdates',
      '-authenticationKeyPath',
      ios.apiKeyPath,
      '-authenticationKeyID',
      ios.apiKeyId,
      '-authenticationKeyIssuerID',
      ios.apiIssuerId,
    ];
    const maskedAuthArgs = [
      '-allowProvisioningUpdates',
      '-authenticationKeyPath',
      path.basename(ios.apiKeyPath),
      '-authenticationKeyID',
      ios.apiKeyId,
      '-authenticationKeyIssuerID',
      '***',
    ];

    runStep(
      'xcodebuild',
      [
        '-workspace',
        IOS_WORKSPACE,
        '-scheme',
        IOS_SCHEME,
        '-configuration',
        'Release',
        '-destination',
        'generic/platform=iOS',
        '-archivePath',
        archivePath,
        `DEVELOPMENT_TEAM=${ios.teamId}`,
        ...authArgs,
        'archive',
      ],
      {
        cwd: IOS_DIR,
        displayArgs: [
          '-workspace',
          'StopMind.xcworkspace',
          '-scheme',
          IOS_SCHEME,
          '-configuration',
          'Release',
          '-destination',
          'generic/platform=iOS',
          '-archivePath',
          path.relative(ROOT_DIR, archivePath),
          `DEVELOPMENT_TEAM=${ios.teamId}`,
          ...maskedAuthArgs,
          'archive',
        ],
      }
    );

    runStep(
      'xcodebuild',
      [
        '-exportArchive',
        '-archivePath',
        archivePath,
        '-exportOptionsPlist',
        exportPlistPath,
        '-exportPath',
        exportDir,
        ...authArgs,
      ],
      {
        cwd: IOS_DIR,
        displayArgs: [
          '-exportArchive',
          '-archivePath',
          path.relative(ROOT_DIR, archivePath),
          '-exportOptionsPlist',
          path.relative(ROOT_DIR, exportPlistPath),
          '-exportPath',
          path.relative(ROOT_DIR, exportDir),
          ...maskedAuthArgs,
        ],
      }
    );

    const ipaFiles = fs
      .readdirSync(exportDir)
      .filter((f) => f.endsWith('.ipa'));
    if (ipaFiles.length === 0) {
      throw new Error(`No se encontró ningún .ipa en ${exportDir}`);
    }
    const ipaSrc = path.join(exportDir, ipaFiles[0]);
    const ipaDest = path.join(outDir, `STOPMind-v${version}-b${iosBuild}.ipa`);
    fs.copyFileSync(ipaSrc, ipaDest);
    generatedFiles.push(ipaDest);
    logOk(`IPA generado: ${formatFileSummary(ipaDest)}`);

    if (opts.uploadIos) {
      logSection('6. Subiendo iOS a App Store Connect / TestFlight');
      runStep(
        'xcrun',
        [
          'altool',
          '--upload-app',
          '--type',
          'ios',
          '-f',
          ipaDest,
          '--apiKey',
          ios.apiKeyId,
          '--apiIssuer',
          ios.apiIssuerId,
          '--p8-file-path',
          ios.apiKeyPath,
        ],
        {
          cwd: ROOT_DIR,
          displayArgs: [
            'altool',
            '--upload-app',
            '--type',
            'ios',
            '-f',
            path.relative(ROOT_DIR, ipaDest),
            '--apiKey',
            ios.apiKeyId,
            '--apiIssuer',
            '***',
            '--p8-file-path',
            path.basename(ios.apiKeyPath),
          ],
        }
      );
      logOk(
        `Build iOS v${version} (${iosBuild}) subida a App Store Connect. Aparecerá en TestFlight en ~5–10 min.`
      );
    }
  }

  logSection('Release Finalizado con Éxito');
  for (const file of generatedFiles) {
    logOk(formatFileSummary(file));
  }
  console.log('');
}

try {
  main();
} catch (err) {
  console.log('');
  logErr(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
