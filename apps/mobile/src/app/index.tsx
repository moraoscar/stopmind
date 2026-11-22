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
import { COLORS } from '../constants/game';
import { useGame } from '../context/GameContext';

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

  const baseOuterSize = isCompactScreen ? 216 : 244;
  const baseMiddleSize = isCompactScreen ? 188 : 214;
  const baseCircleSize = isCompactScreen ? 160 : 184;

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
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  containerKeyboard: {
    paddingVertical: 8,
  },
  topSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  topSectionCompact: {
    gap: 8,
    marginTop: 4,
  },
  logoBadge: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 3,
  },
  logoTextCompact: {
    fontSize: 24,
    letterSpacing: 2.2,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.ink,
    opacity: 0.78,
    textAlign: 'center',
    fontWeight: '600',
  },
  nameCard: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    width: '78%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    padding: 0,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    backgroundColor: COLORS.stopRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  playCirclePressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: COLORS.stopRedDark,
  },
  playIcon: {
    marginLeft: 4,
    marginBottom: 2,
  },
  playLabel: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  playLabelCompact: {
    fontSize: 24,
  },
  bottomSection: {
    gap: 14,
    marginBottom: 6,
  },
  bottomSectionCompact: {
    gap: 0,
    marginBottom: 4,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  joinButtonCompact: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  joinButtonPressed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  joinIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinTextWrap: {
    flex: 1,
  },
  joinTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  joinSub: {
    fontSize: 12,
    color: COLORS.inkMuted,
    marginTop: 1,
  },
  lanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lanBadgeText: {
    fontSize: 12,
    color: COLORS.ink,
    opacity: 0.72,
    fontWeight: '600',
  },
  privacyLinkBtn: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  privacyLinkText: {
    fontSize: 12,
    color: COLORS.indigo,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
