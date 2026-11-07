import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { BunnyLoader } from '@/components/bunny-loader';
import { SparkleIcon } from '@/components/icons';
import { NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { celebrate, type Celebration } from '@/lib/celebrate';

const SHOW_MS = 2600;

/** The settled-up moment: the hopping bunny on the night sky, then it gets out of the way. Tap to close early. */
export function SettledHost() {
  const [shown, setShown] = useState<Celebration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => celebrate.subscribe((c) => {
    setShown(c);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility(`${c.title} ${c.body ?? ''}`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), SHOW_MS);
  }), []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!shown) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => setShown(null)} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={`${shown.title} ${shown.body ?? ''} Tap to close.`} onPress={() => setShown(null)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,24,0.45)' }} />
        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ width: '100%', maxWidth: 340 }}>
          <NightSurface fireflies style={{ borderRadius: HT.radius.card, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 6 }}>
            <BunnyLoader size={128} tone="night" label="Settled" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <SparkleIcon size={18} color={HT.color.glow} />
              <T v="display" style={{ color: HT.color.onDarkText, fontSize: 28 }}>{shown.title}</T>
              <SparkleIcon size={18} color={HT.color.glow} />
            </View>
            {shown.body ? <T style={{ color: HT.color.darkCardMuted, textAlign: 'center' }}>{shown.body}</T> : null}
          </NightSurface>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
