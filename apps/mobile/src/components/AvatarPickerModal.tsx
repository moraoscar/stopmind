import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  AVATAR_BG_COLORS,
  AVATARS,
  getAvatarBgOption,
  getAvatarOption,
} from '../constants/avatars';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  RADII,
  SHADOWS,
  SPACING,
} from '../theme/tokens';

interface AvatarPickerModalProps {
  visible: boolean;
  selectedAvatarId: string;
  selectedBgId: string;
  playerName?: string;
  onSelectAvatar: (avatarId: string) => void;
  onSelectBg: (bgId: string) => void;
  onClose: () => void;
}

export function AvatarPickerModal({
  visible,
  selectedAvatarId,
  selectedBgId,
  playerName,
  onSelectAvatar,
  onSelectBg,
  onClose,
}: AvatarPickerModalProps) {
  const activeAvatar = getAvatarOption(selectedAvatarId);
  const activeBg = getAvatarBgOption(selectedBgId, activeAvatar);

  const hapticTap = () => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  const handlePickAvatar = (id: string) => {
    hapticTap();
    onSelectAvatar(id);
  };

  const handlePickBg = (bgId: string) => {
    hapticTap();
    onSelectBg(bgId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Personaliza tu avatar</Text>
              <Text style={styles.subtitle}>
                Elige personaje y color de fondo · Guardado en tu teléfono
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
              accessibilityLabel="Cerrar selector de avatar"
            >
              <Ionicons name="close" size={20} color={COLORS.ink} />
            </Pressable>
          </View>

          {/* Live preview of selected character + custom background */}
          <View style={styles.previewCard}>
            <View
              style={[
                styles.previewCircle,
                {
                  backgroundColor: activeBg.bgColor,
                  borderColor: activeBg.ringColor,
                },
              ]}
            >
              <Image
                source={activeAvatar.source}
                style={styles.previewImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>
                {playerName?.trim() || 'Jugador'}
              </Text>
              <Text style={styles.previewBadge}>
                {activeAvatar.label} · Fondo {activeBg.label}
              </Text>
            </View>
          </View>

          {/* Background color swatches */}
          <Text style={styles.sectionLabel}>Color de fondo</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchesRow}
            style={styles.swatchesScroll}
          >
            {AVATAR_BG_COLORS.map((swatch) => {
              const isSelected = swatch.id === activeBg.id;
              return (
                <Pressable
                  key={swatch.id}
                  onPress={() => handlePickBg(swatch.id)}
                  accessibilityLabel={`Color ${swatch.label}`}
                  style={({ pressed }) => [
                    styles.swatchOuter,
                    isSelected && {
                      borderColor: COLORS.ink,
                      transform: [{ scale: 1.08 }],
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View
                    style={[
                      styles.swatchFill,
                      { backgroundColor: swatch.bgColor },
                    ]}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={swatch.id === 'gold' ? COLORS.ink : COLORS.white}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Character grid (4 columns x 4 rows = 16 inclusive avatars) */}
          <Text style={styles.sectionLabel}>Personaje</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {AVATARS.map((item) => {
              const selected = item.id === activeAvatar.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handlePickAvatar(item.id)}
                  style={({ pressed }) => [
                    styles.tile,
                    selected && styles.tileSelected,
                    pressed && styles.tilePressed,
                  ]}
                >
                  <View style={styles.avatarWrap}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: activeBg.bgColor,
                          borderColor: selected
                            ? COLORS.indigo
                            : activeBg.ringColor,
                          borderWidth: selected ? 3 : 2,
                        },
                      ]}
                    >
                      <Image
                        source={item.source}
                        style={styles.avatarImg}
                        resizeMode="cover"
                      />
                    </View>
                    {selected && (
                      <View style={styles.checkBadge}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.white}
                        />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tileLabel,
                      selected && styles.tileLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              pressed && styles.doneBtnPressed,
            ]}
          >
            <Text style={styles.doneBtnText}>¡Listo!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.base,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  previewCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  previewImg: {
    width: 56,
    height: 56,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  previewBadge: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.indigo,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: SPACING.xs,
  },
  swatchesScroll: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 4,
    paddingRight: SPACING.sm,
  },
  swatchOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    borderColor: 'transparent',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchFill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
  },
  tile: {
    width: '23.5%',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 3,
    borderRadius: RADII.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: COLORS.bg,
    marginBottom: SPACING.sm,
  },
  tileSelected: {
    backgroundColor: COLORS.indigoSoft,
    borderColor: COLORS.indigo,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatarImg: {
    width: 54,
    height: 54,
  },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.indigo,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
    textAlign: 'center',
  },
  tileLabelSelected: {
    color: COLORS.indigoDark,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  doneBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.navy,
    borderRadius: RADII.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  doneBtnPressed: {
    opacity: 0.9,
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
    letterSpacing: 0.4,
  },
});
