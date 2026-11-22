import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';

interface QrScannerViewProps {
  onScanned: (data: string) => void;
  onSwitchToManual?: () => void;
  disabled?: boolean;
  resetSignal?: number;
}

export function QrScannerView({
  onScanned,
  onSwitchToManual,
  disabled,
  resetSignal = 0,
}: QrScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // Synchronous ref lock prevents CameraView from firing multiple scan callbacks in <10ms
  const scannedRef = useRef(false);
  const [pauseState, setPauseState] = useState({
    signal: resetSignal,
    paused: false,
  });
  const paused = pauseState.signal === resetSignal ? pauseState.paused : false;

  useEffect(() => {
    scannedRef.current = false;
  }, [resetSignal]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="camera-outline" size={40} color={COLORS.inkMuted} />
        <Text style={styles.fallbackTitle}>Escáner QR disponible en móvil</Text>
        <Text style={styles.fallbackDesc}>
          En navegador web usa la pestaña &ldquo;Código manual&rdquo; para
          unirte a la sala WiFi.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.fallbackBox}>
        <Text style={styles.fallbackDesc}>Comprobando permiso de cámara…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const blocked = permission.status === 'denied' && !permission.canAskAgain;
    return (
      <View style={styles.fallbackBox}>
        <Ionicons name="qr-code-outline" size={44} color={COLORS.indigo} />
        <Text style={styles.fallbackTitle}>
          {blocked
            ? 'Cámara desactivada en Ajustes'
            : 'Permiso de cámara opcional'}
        </Text>
        <Text style={styles.fallbackDesc}>
          {blocked
            ? 'Puedes activar la cámara en Ajustes para escanear el QR, o unirte directamente con el código de sala.'
            : 'Usamos la cámara solo para escanear el código QR del anfitrión. También puedes unirte sin cámara usando el código manual.'}
        </Text>
        <View style={styles.permActions}>
          <Pressable
            style={styles.permBtn}
            onPress={() => {
              if (blocked) {
                void Linking.openSettings();
              } else {
                void requestPermission();
              }
            }}
          >
            <Text style={styles.permBtnText}>
              {blocked ? 'Abrir Ajustes' : 'Permitir cámara'}
            </Text>
          </Pressable>
          {onSwitchToManual && (
            <Pressable style={styles.manualAltBtn} onPress={onSwitchToManual}>
              <Text style={styles.manualAltText}>Usar código manual</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const handleRetryScan = () => {
    scannedRef.current = false;
    setPauseState({ signal: resetSignal, paused: false });
  };

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          disabled || paused
            ? undefined
            : ({ data }) => {
                if (!data || scannedRef.current) return;
                scannedRef.current = true;
                setPauseState({ signal: resetSignal, paused: true });
                onScanned(data);
              }
        }
      />
      <View style={styles.overlay}>
        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        {paused && !disabled ? (
          <Pressable style={styles.retryPill} onPress={handleRetryScan}>
            <Ionicons name="refresh" size={14} color="#FFFFFF" />
            <Text style={styles.hintText}>Toca para escanear de nuevo</Text>
          </Pressable>
        ) : (
          <View style={styles.hintPill} pointerEvents="none">
            <Text style={styles.hintText}>
              {disabled ? 'Conectando a la sala…' : 'Apunta al QR de la sala'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 310,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    gap: 16,
  },
  frame: {
    width: 205,
    height: 205,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
    borderWidth: 4,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  hintPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackBox: {
    height: 260,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
  },
  fallbackDesc: {
    fontSize: 13,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  permActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  permBtn: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
  },
  permBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  manualAltBtn: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  manualAltText: {
    color: COLORS.ink,
    fontWeight: '800',
    fontSize: 13,
  },
});
