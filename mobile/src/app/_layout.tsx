import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts as useDMSansFonts,
} from '@expo-google-fonts/dm-sans';
import { IBMPlexMono_500Medium, useFonts as usePlexFonts } from '@expo-google-fonts/ibm-plex-mono';
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts as useOutfitFonts } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettledHost } from '@/components/settled-host';
import { FullScreenLoader } from '@/components/bunny-loader';
import { HT } from '@/constants/theme';
import { LockGate } from '@/components/lock-gate';
import { listenForTaps, registerDevice } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

function Root() {
  const [dmSans] = useDMSansFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  const [outfit] = useOutfitFonts({ Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  const [plex] = usePlexFonts({ IBMPlexMono_500Medium });
  const [tabular] = useFonts({
    DMSansTabular_500Medium: require('../../assets/fonts/DMSansTabular_500Medium.ttf'),
    DMSansTabular_700Bold: require('../../assets/fonts/DMSansTabular_700Bold.ttf'),
  });
  const { ready, user } = useSession();
  const fonts = dmSans && outfit && plex && tabular;

  // The splash only waits for fonts; while the session restores, the hopping bunny shows.
  useEffect(() => {
    if (fonts) SplashScreen.hideAsync().catch(() => {});
  }, [fonts]);

  useEffect(() => {
    if (!user) return;
    registerDevice();
    return listenForTaps();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fonts) return null;
  if (!ready) {
    return (
      <>
        <StatusBar style="light" />
        <FullScreenLoader tone="night" />
      </>
    );
  }
  return (
    <>
      <StatusBar style="dark" />
      <LockGate enabled={!!user?.face_id_lock}>
        {/* Pop-up screens are declared here, before they open: iOS can't switch a screen
            to modal after it has started presenting (doing it inside the screen crashed). */}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: HT.color.ground }, animation: 'slide_from_right' }}>
          <Stack.Screen name="add" options={MODAL} />
          <Stack.Screen name="itemize" options={MODAL} />
          <Stack.Screen name="bill-edit" options={MODAL} />
          <Stack.Screen name="counter" options={MODAL} />
          <Stack.Screen name="group/new" options={MODAL} />
          <Stack.Screen name="request-friend" options={MODAL} />
        </Stack>
        <SettledHost />
      </LockGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <Root />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
