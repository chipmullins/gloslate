import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInDown, SlideInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHECK_AT_MS, CleanSlateScene, SCENE_MS } from '@/components/clean-slate';
import { Button, NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { celebrate, type Celebration, type CelebrationStyle } from '@/lib/celebrate';
import { useSession } from '@/lib/session';

/** How long each style stays up before getting out of the way (tap closes it sooner). */
const STAY_MS: Record<CelebrationStyle, number> = { full: SCENE_MS + 3000, card: SCENE_MS + 1800, sheet: SCENE_MS + 2600 };

/**
 * The clean slate moment (canvas "Gloslate · Clean slate moment"), in the style the
 * person picked: A full screen (default), B a card at the top, C a bottom sheet.
 */
export function SettledHost() {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState<(Celebration & { style: CelebrationStyle; n: number }) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pref: CelebrationStyle = user?.celebration_style ?? 'full';

  useEffect(() => celebrate.subscribe((c) => {
    timers.current.forEach(clearTimeout);
    const style = c.style ?? pref;
    setShown({ ...c, style, n: Date.now() });
    AccessibilityInfo.announceForAccessibility(`${c.title} ${c.body ?? ''}`);
    // The tap of success lands with the check (straight away with Reduce Motion).
    timers.current = [
      setTimeout(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }, reduce ? 0 : CHECK_AT_MS),
      setTimeout(() => setShown(null), STAY_MS[style]),
    ];
  }), [reduce, pref]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!shown) return null;
  const close = () => setShown(null);
  const textIn = (ms: number) => (reduce ? FadeIn.duration(200) : FadeInDown.delay(ms).duration(420));
  const title = (size: number) => (
    <T v="display" accessibilityRole="header" style={{ color: HT.color.onDarkText, fontSize: size, lineHeight: size * 1.2, textAlign: 'center' }}>{shown.title}</T>
  );
  const body = shown.body ? <T style={{ color: HT.color.darkCardMuted, textAlign: 'center', fontSize: 15.5, lineHeight: 22 }}>{shown.body}</T> : null;

  if (shown.style === 'card') {
    // B: a card at the top of whatever screen is open; nothing dims behind it.
    return (
      <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
        <View style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 8, paddingHorizontal: 16 }} pointerEvents="box-none">
          <Animated.View key={shown.n} entering={reduce ? FadeIn.duration(200) : SlideInUp.springify().damping(18)} exiting={FadeOut.duration(180)}
            style={{ width: '100%', maxWidth: 400 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${shown.title} ${shown.body ?? ''} Tap to close.`} onPress={close}>
              <NightSurface fireflies style={{ borderRadius: HT.radius.card, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                <CleanSlateScene size={190} amountCents={shown.amountCents} />
                <Animated.View entering={textIn(1500)} style={{ gap: 4, alignItems: 'center' }}>{title(22)}{body}</Animated.View>
              </NightSurface>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  if (shown.style === 'sheet') {
    // C: a bottom sheet over a dimmed screen.
    return (
      <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
        <Pressable accessibilityLabel="Close" onPress={close} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,24,0.5)' }} />
          <Animated.View key={shown.n} entering={reduce ? FadeIn.duration(200) : SlideInDown.springify().damping(20)}
            style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <NightSurface fireflies style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24,
              paddingBottom: insets.bottom + 24, alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF33' }} />
              <CleanSlateScene size={220} amountCents={shown.amountCents} />
              <Animated.View entering={textIn(2000)} style={{ gap: 6, alignItems: 'center', alignSelf: 'stretch' }}>
                {title(26)}{body}
                <Button kind="glass" title="Nice" onPress={close} style={{ alignSelf: 'stretch', marginTop: 10 }} />
              </Animated.View>
            </NightSurface>
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }

  // A (default): the whole screen turns to night sky for the moment.
  const scene = Math.min(300, width - 56);
  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View key={shown.n} entering={FadeIn.duration(320)} exiting={FadeOut.duration(220)} style={{ flex: 1 }}>
        <NightSurface fireflies style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
          paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ width: '100%', maxWidth: 420, alignItems: 'center', gap: 20 }}>
            <CleanSlateScene size={scene} amountCents={shown.amountCents} />
            <Animated.View entering={textIn(2000)} style={{ gap: 10, alignItems: 'center' }}>{title(32)}{body}</Animated.View>
            <Animated.View entering={reduce ? FadeIn.duration(200) : FadeInUp.delay(2300).duration(420)} style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <Button kind="onDark" title="Done" onPress={close} />
            </Animated.View>
          </View>
        </NightSurface>
      </Animated.View>
    </Modal>
  );
}
