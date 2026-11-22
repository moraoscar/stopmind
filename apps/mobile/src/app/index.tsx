import React, { useEffect, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurredWordsBackdrop } from '../components/BlurredWordsBackdrop';
import { useGame } from '../context/GameContext';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SHADOWS,
  SIZES,
  SPACING,
} from '../theme/tokens';

export default function HomeScreen() {
  const { playerName, setPlayerName } = useGame();
  const { height } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [playScale] = useState(() => new Animated.Value(1));

  const isCompactScreen = height < 740;

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      Animated.spring(playScale, {
        toValue: 0.56,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      Animated.spring(playScale, {
        toValue: 1,
        friction: 7,
        tension: 85,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [playScale]);

  const playDims = isCompactScreen
    ? SIZES.homePlayButton.compact
    : SIZES.homePlayButton.regular;
  const baseOuterSize = playDims.outer;
  const baseMiddleSize = playDims.middle;
  const baseCircleSize = playDims.inner;

  // Shrink layout footprint while keyboard is open so JUGAR never collides with Join on iPhone 12 / SE
  const stageHeight = keyboardVisible ? 132 : baseOuterSize;

  return (
    <View style={styles.root}>
      <BlurredWordsBackdrop />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={[
              styles.container,
              keyboardVisible && styles.containerKeyboard,
            ]}
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            {/* Top brand & editable player name */}
            <View
              style={[
                styles.topSection,
                keyboardVisible && styles.topSectionCompact,
              ]}
            >
              <View style={styles.logoBadge}>
                <Text
                  style={[
                    styles.logoText,
                    keyboardVisible && styles.logoTextCompact,
                  ]}
                >
                  STOPMind!
                </Text>
              </View>
              {!keyboardVisible && (
                <Text style={styles.tagline}>
                  Llena las categorías antes de que se acabe el tiempo
                </Text>
              )}

              <View style={styles.nameCard}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={COLORS.indigo}
                />
                <TextInput
                  style={styles.nameInput}
                  value={playerName}
                  onChangeText={setPlayerName}
                  placeholder="Tu nombre"
                  placeholderTextColor={COLORS.slate}
                  maxLength={22}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                {playerName.length > 0 && (
                  <Pressable onPress={() => setPlayerName('')} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={COLORS.slate}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Centerpiece: Large Circular JUGAR Button (scales down smoothly when keyboard opens) */}
            <View
              style={[
                styles.centerStage,
                { minHeight: stageHeight, maxHeight: keyboardVisible ? 148 : undefined },
              ]}
            >
              <Animated.View
                style={[
                  styles.outerRing,
                  {
                    width: baseOuterSize,
                    height: baseOuterSize,
                    borderRadius: baseOuterSize / 2,
                    transform: [{ scale: playScale }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.middleRing,
                    {
                      width: baseMiddleSize,
                      height: baseMiddleSize,
                      borderRadius: baseMiddleSize / 2,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push('/setup');
                    }}
                    style={({ pressed }) => [
                      styles.playCircle,
                      {
                        width: baseCircleSize,
                        height: baseCircleSize,
                        borderRadius: baseCircleSize / 2,
                      },
                      pressed && styles.playCirclePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Jugar"
                  >
                    <Ionicons
                      name="play"
                      size={isCompactScreen ? 30 : 34}
                      color="#FFFFFF"
                      style={styles.playIcon}
                    />
                    <Text
                      style={[
                        styles.playLabel,
                        isCompactScreen && styles.playLabelCompact,
                      ]}
                    >
                      JUGAR
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>

            {/* Secondary WiFi LAN Join CTA */}
            <View
              style={[
                styles.bottomSection,
                keyboardVisible && styles.bottomSectionCompact,
              ]}
            >
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  router.push('/join');
                }}
                style={({ pressed }) => [
                  styles.joinButton,
                  keyboardVisible && styles.joinButtonCompact,
                  pressed && styles.joinButtonPressed,
                ]}
              >
                <View style={styles.joinIconWrap}>
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={COLORS.indigo}
                  />
                </View>
                <View style={styles.joinTextWrap}>
                  <Text style={styles.joinTitle}>Unirse a una partida</Text>
                  <Text style={styles.joinSub}>
                    Escanear QR o ingresar código WiFi
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.inkMuted}
                />
              </Pressable>

              {!keyboardVisible && (
                <>
                  <View style={styles.lanBadge}>
                    <Ionicons name="wifi" size={14} color={COLORS.emerald} />
                    <Text style={styles.lanBadgeText}>
                      Multijugador en la misma red WiFi · Sin internet
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        'https://stopmind.cxvone.com/app-privacy'
                      )
                    }
                    hitSlop={8}
                    style={styles.privacyLinkBtn}
                  >
                    <Text style={styles.privacyLinkText}>
                      Política de Privacidad
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.xl,
    justifyContent: 'space-between',
  },
  containerKeyboard: {
    paddingVertical: SPACING.sm,
  },
  topSection: {
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.base,
  },
  topSectionCompact: {
    gap: SPACING.sm,
    marginTop: SPACING.xxs,
  },
  logoBadge: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.xl,
    transform: [{ rotate: '-2deg' }],
    ...SHADOWS.md,
  },
  logoText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.display,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.logo,
  },
  logoTextCompact: {
    fontSize: FONT_SIZES.h2,
    letterSpacing: LETTER_SPACING.brand,
  },
  tagline: {
    fontSize: FONT_SIZES.base,
    color: COLORS.ink,
    opacity: 0.78,
    textAlign: 'center',
    fontWeight: FONT_WEIGHTS.semibold,
  },
  nameCard: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceTranslucent,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md - 1,
    width: '78%',
    maxWidth: 280,
    ...SHADOWS.sm,
  },
  nameInput: {
    flex: 1,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
    padding: 0,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    backgroundColor: COLORS.stopRedRingOuter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    backgroundColor: COLORS.stopRedRingMiddle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    backgroundColor: COLORS.stopRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: COLORS.white,
    ...SHADOWS.stopButton,
  },
  playCirclePressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: COLORS.stopRedDark,
  },
  playIcon: {
    marginLeft: SPACING.xxs,
    marginBottom: 2,
  },
  playLabel: {
    color: COLORS.white,
    fontSize: FONT_SIZES.title,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.play,
  },
  playLabelCompact: {
    fontSize: FONT_SIZES.h2,
  },
  bottomSection: {
    gap: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  bottomSectionCompact: {
    gap: 0,
    marginBottom: SPACING.xxs,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    backgroundColor: COLORS.surfaceTranslucent,
    borderRadius: RADII.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  joinButtonCompact: {
    paddingVertical: SPACING.base - 1,
    paddingHorizontal: SPACING.lg,
  },
  joinButtonPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  joinIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinTextWrap: {
    flex: 1,
  },
  joinTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  joinSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    marginTop: 1,
  },
  lanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  lanBadgeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.ink,
    opacity: 0.72,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  privacyLinkBtn: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  privacyLinkText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.indigo,
    fontWeight: FONT_WEIGHTS.bold,
    textDecorationLine: 'underline',
  },
});
