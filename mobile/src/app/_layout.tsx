import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, useFonts as usePlexFonts } from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts as useManropeFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HT } from '@/constants/theme';
import { LockGate } from '@/components/lock-gate';
import { listenForTaps, registerDevice } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const [manrope] = useManropeFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const [plex] = usePlexFonts({ IBMPlexMono_500Medium, IBMPlexMono_600SemiBold });
  const { ready, user } = useSession();
  const loaded = manrope && plex && ready;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  useEffect(() => {
    if (!user) return;
    registerDevice();
    return listenForTaps();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null;
  return (
    <>
      <StatusBar style="dark" />
      <LockGate enabled={!!user?.face_id_lock}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: HT.color.ground }, animation: 'slide_from_right' }} />
      </LockGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
