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
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SHADOWS,
  SIZES,
  SPACING,
} from '../theme/tokens';
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
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.huge,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  iconCircle: {
    width: SIZES.iconBtn,
    height: SIZES.iconBtn,
    borderRadius: SIZES.iconBtn / 2,
    backgroundColor: COLORS.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: SIZES.closeBtn,
    height: SIZES.closeBtn,
    borderRadius: SIZES.closeBtn / 2,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  body: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xl,
  },
  qrCard: {
    padding: SPACING.xxl,
    backgroundColor: COLORS.white,
    borderRadius: RADII.modal,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  helperText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: SPACING.sm,
  },
  bold: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  codeSection: {
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  codeLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: LETTER_SPACING.wider,
    color: COLORS.inkMuted,
  },
  codeTiles: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  codeTile: {
    width: 48,
    height: 54,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    fontSize: FONT_SIZES.h2,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.indigo,
  },
  wsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    fontFamily: FONTS.mono,
    marginTop: 2,
  },
  playersBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.xl + 2,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  playersTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  playersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlineDot: {
    width: SIZES.statusDot,
    height: SIZES.statusDot,
    borderRadius: SIZES.statusDot / 2,
    backgroundColor: COLORS.emerald,
  },
  playerChipText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.ink,
  },
  offlineBox: {
    alignItems: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  offlineTitle: {
    fontSize: FONT_SIZES.lg + 1,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
    textAlign: 'center',
  },
  offlineDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  cmdBox: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADII.md,
    marginVertical: SPACING.xxs,
  },
  cmdText: {
    color: COLORS.mintHighlight,
    fontFamily: FONTS.mono,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.base,
  },
  offlineHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
  doneBtn: {
    marginTop: SPACING.base,
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg,
    borderRadius: RADII.xl,
    alignItems: 'center',
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
});
