import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HouseMark } from '@/components/icons';
import { NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { fetchStatus } from '@/lib/api';
import { paused, type PauseInfo } from '@/lib/paused';
import { useSession } from '@/lib/session';

const EVERY_MS = 30_000;

/**
 * "Gloslate is paused" (staff turned on the kill switch in Control). Covers
 * the app, checks every 30 seconds, and goes away by itself when it's back.
 */
export function PausedScreen() {
  const [info, setInfo] = useState<PauseInfo | null>(paused.get());
  const { refresh } = useSession();
  useEffect(() => paused.subscribe(setInfo), []);

  // Also notice a pause that started while the app was idle.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const s = await fetchStatus();
      if (!alive || !s) return;
      if (s.paused) paused.set({ message: s.message ?? '', since: s.since });
      else if (paused.get()) {
        paused.set(null);
        refresh().catch(() => {});
      }
    };
    check();
    const t = setInterval(check, info ? EVERY_MS : EVERY_MS * 4);
    return () => { alive = false; clearInterval(t); };
  }, [info, refresh]);

  if (!info) return null;
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <NightSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <HouseMark size={72} inverted />
        <T v="display" accessibilityRole="header" style={{ color: HT.color.onDarkText, textAlign: 'center' }}>
          <T v="display" style={{ color: HT.color.glow }}>glo</T>slate is paused
        </T>
        <T style={{ color: HT.color.onDarkText, textAlign: 'center', maxWidth: 360, lineHeight: 22 }}>{info.message}</T>
        <T v="small" style={{ color: HT.color.darkCardMuted, textAlign: 'center' }}>Nothing is lost. This checks again every 30 seconds and goes away on its own.</T>
      </NightSurface>
    </View>
  );
}
