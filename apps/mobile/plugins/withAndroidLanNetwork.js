const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Allows local WiFi peer-to-peer WebSockets (ws://192.168.x.x:3001 / hotspot LAN)
       while all cloud endpoints (AWS API, Cloudflare Realtime) strictly use HTTPS/WSS. -->
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_MULTICAST_STATE',
];

const OPTIONAL_FEATURES = [
  'android.hardware.screen.portrait',
  'android.hardware.wifi',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
];

function withAndroidLanNetwork(config) {
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG_XML,
        'utf8'
      );
      return modConfig;
    },
  ]);

  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }

    const existing = new Set(
      manifest['uses-permission']
        .map((p) => p?.$?.['android:name'])
        .filter(Boolean)
    );

    for (const perm of REQUIRED_PERMISSIONS) {
      if (!existing.has(perm)) {
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    if (!Array.isArray(manifest['uses-feature'])) {
      manifest['uses-feature'] = [];
    }

    for (const featureName of OPTIONAL_FEATURES) {
      const existingFeature = manifest['uses-feature'].find(
        (f) => f?.$?.['android:name'] === featureName
      );
      if (existingFeature && existingFeature.$) {
        existingFeature.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
          },
        });
      }
    }

    const app = manifest.application?.[0];
    if (app && app.$) {
      app.$['android:usesCleartextTraffic'] = 'true';
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      app.$['android:allowBackup'] = 'false';
    }

    return modConfig;
  });

  return config;
}

module.exports = withAndroidLanNetwork;
