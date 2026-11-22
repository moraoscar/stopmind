import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../constants/game';
import { PlayerInfo } from '../types/game';

interface QrInviteModalProps {
  visible: boolean;
  onClose: () => void;
  qrPayload: string | null;
  roomCode: string | null;
  wsUrl: string;
  players: PlayerInfo[];
}

export function QrInviteModal({
  visible,
  onClose,
  qrPayload,
  roomCode,
  wsUrl,
  players,
}: QrInviteModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="qr-code" size={20} color={COLORS.indigo} />
              </View>
              <View>
                <Text style={styles.title}>Invitar jugadores (WiFi)</Text>
                <Text style={styles.subtitle}>
                  Misma red WiFi · Sin internet
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={10}
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={COLORS.ink} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {qrPayload && roomCode ? (
              <>
                <View style={styles.qrCard}>
                  <QRCode
                    value={qrPayload}
                    size={210}
                    color={COLORS.ink}
                    backgroundColor="#FFFFFF"
                  />
                </View>

                <Text style={styles.helperText}>
                  Los demás jugadores deben abrir{' '}
                  <Text style={styles.bold}>STOPMind!</Text>, tocar{' '}
                  <Text style={styles.bold}>Unirse con QR</Text> y escanear este
                  código.
                </Text>

                <View style={styles.codeSection}>
                  <Text style={styles.codeLabel}>CÓDIGO DE SALA</Text>
                  <View style={styles.codeTiles}>
                    {roomCode.split('').map((char, i) => (
                      <View key={`${char}-${i}`} style={styles.codeTile}>
                        <Text style={styles.codeChar}>{char}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.wsText}>{wsUrl}</Text>
                </View>

                <View style={styles.playersBox}>
                  <View style={styles.playersHeader}>
                    <Ionicons name="people" size={16} color={COLORS.indigo} />
                    <Text style={styles.playersTitle}>
                      Conectados en la sala ({players.length})
                    </Text>
                  </View>
                  <View style={styles.playersWrap}>
                    {players.map((p) => (
                      <View key={p.id} style={styles.playerChip}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.playerChipText}>
                          {p.name}
                          {p.isHost ? ' (Tú)' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.offlineBox}>
                <Ionicons
                  name="wifi-outline"
                  size={44}
                  color={COLORS.inkMuted}
                />
                <Text style={styles.offlineTitle}>
                  Servidor WiFi local no conectado
                </Text>
                <Text style={styles.offlineDesc}>
                  Para invitar a otros jugadores en tu misma red WiFi, inicia el
                  servidor local con:
                </Text>
                <View style={styles.cmdBox}>
                  <Text style={styles.cmdText}>npm run server</Text>
                </View>
                <Text style={styles.offlineHint}>
                  Luego toca &ldquo;Reconectar WiFi&rdquo; en la pantalla de
                  configuración.
                </Text>
              </View>
            )}
          </ScrollView>

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.inkMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  body: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  qrCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  codeSection: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: COLORS.inkMuted,
  },
  codeTiles: {
    flexDirection: 'row',
    gap: 10,
  },
  codeTile: {
    width: 48,
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.indigo,
  },
  wsText: {
    fontSize: 12,
    color: COLORS.inkMuted,
    fontFamily: 'Courier',
    marginTop: 2,
  },
  playersBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playersTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  playersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.emerald,
  },
  playerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  offlineBox: {
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  offlineTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
  },
  offlineDesc: {
    fontSize: 13,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  cmdBox: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginVertical: 4,
  },
  cmdText: {
    color: '#A7F3D0',
    fontFamily: 'Courier',
    fontWeight: '700',
    fontSize: 14,
  },
  offlineHint: {
    fontSize: 12,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
  doneBtn: {
    marginTop: 12,
    backgroundColor: COLORS.indigo,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
