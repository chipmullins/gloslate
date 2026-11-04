import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, View } from 'react-native';

import { HouseMark } from '@/components/icons';
import { Button, T } from '@/components/ui';
import { HT } from '@/constants/theme';

const RELOCK_AFTER_MS = 30_000;

/** Face ID / fingerprint lock (Settings → Face ID lock). Relocks after 30s in the background. */
export function LockGate({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [lockedState, setLocked] = useState(true);
  const locked = enabled && Platform.OS !== 'web' && lockedState;
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock HomeTab', fallbackLabel: 'Use passcode' });
    if (res.success) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    Promise.resolve().then(unlock); // prompt right after mount
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, backgroundColor: HT.color.ground, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
          <HouseMark size={72} />
          <T v="title">HomeTab is locked</T>
          <Button title="Unlock" onPress={unlock} style={{ alignSelf: 'stretch', maxWidth: 360, width: '100%' }} />
        </View>
      ) : null}
    </View>
  );
}
