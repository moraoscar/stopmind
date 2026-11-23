import React, { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { GameProvider } from '../context/GameContext';
import { COLORS } from '../theme/tokens';
import { parseJoinQrPayload } from '../utils/network';

// Hold native launch screen briefly until our animated splash renders its first frame
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function DeepLinkWatcher({ onInviteLink }: { onInviteLink: () => void }) {
  const url = Linking.useURL();
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url || url === lastHandledRef.current) return;
    const parsed = parseJoinQrPayload(url);
    if (parsed) {
      lastHandledRef.current = url;
      onInviteLink();
      router.push({
        pathname: '/join',
        params: {
          ws: parsed.wsUrl,
          room: parsed.roomCode,
          mode: parsed.isOnline ? 'online' : 'lan',
        },
      });
    }
  }, [onInviteLink, url]);

  return null;
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style={splashDone ? 'dark' : 'light'} />
        <DeepLinkWatcher onInviteLink={() => setSplashDone(true)} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="join" />
          <Stack.Screen name="play" options={{ gestureEnabled: false }} />
          <Stack.Screen name="results" options={{ gestureEnabled: false }} />
        </Stack>
        {!splashDone && (
          <AnimatedSplash onFinish={() => setSplashDone(true)} />
        )}
      </GameProvider>
    </SafeAreaProvider>
  );
}
