import React from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/game';
import { useGame } from '../context/GameContext';

export default function HomeScreen() {
  const { playerName, setPlayerName } = useGame();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top brand & editable player name */}
        <View style={styles.topSection}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>STOPMind!</Text>
          </View>
          <Text style={styles.tagline}>
            Llena las categorías antes de que se acabe el tiempo
          </Text>

          <View style={styles.nameCard}>
            <Ionicons name="person-circle-outline" size={20} color={COLORS.indigo} />
            <TextInput
              style={styles.nameInput}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Tu nombre"
              placeholderTextColor={COLORS.slate}
              maxLength={22}
              returnKeyType="done"
            />
            {playerName.length > 0 && (
              <Pressable onPress={() => setPlayerName('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={COLORS.slate} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Centerpiece: Large Circular JUGAR Button */}
        <View style={styles.centerStage}>
          <View style={styles.outerRing}>
            <View style={styles.middleRing}>
              <Pressable
                onPress={() => router.push('/setup')}
                style={({ pressed }) => [
                  styles.playCircle,
                  pressed && styles.playCirclePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Jugar"
              >
                <Ionicons name="play" size={34} color="#FFFFFF" style={styles.playIcon} />
                <Text style={styles.playLabel}>JUGAR</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Secondary WiFi LAN Join CTA */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={() => router.push('/join')}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.joinButtonPressed,
            ]}
          >
            <View style={styles.joinIconWrap}>
              <Ionicons name="qr-code-outline" size={20} color={COLORS.indigo} />
            </View>
            <View style={styles.joinTextWrap}>
              <Text style={styles.joinTitle}>Unirse a una partida</Text>
              <Text style={styles.joinSub}>Escanear QR o ingresar código WiFi</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.inkMuted} />
          </Pressable>

          <View style={styles.lanBadge}>
            <Ionicons name="wifi" size={14} color={COLORS.emerald} />
            <Text style={styles.lanBadgeText}>
              Multijugador en la misma red WiFi · Sin internet
            </Text>
          </View>

          <Pressable
            onPress={() =>
              void Linking.openURL('https://stopmind.cxvone.com/app-privacy')
            }
            hitSlop={8}
            style={styles.privacyLinkBtn}
          >
            <Text style={styles.privacyLinkText}>Política de Privacidad</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  logoBadge: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
    transform: [{ rotate: '-2deg' }],
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.inkMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  nameCard: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    width: '78%',
    maxWidth: 280,
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
    width: 248,
    height: 248,
    borderRadius: 124,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    width: 218,
    height: 218,
    borderRadius: 109,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 186,
    height: 186,
    borderRadius: 93,
    backgroundColor: COLORS.stopRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.38,
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
  bottomSection: {
    gap: 14,
    marginBottom: 6,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    color: COLORS.inkMuted,
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
