import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { toast, type ToastMsg } from '@/lib/toast';

/** Floating toast ("Added Dinner · Undo"). One for the whole app (in the root layout), above the tab bar. */
export function ToastHost({ bottom: offset }: { bottom?: number }) {
  const insets = useSafeAreaInsets();
  const bottom = offset ?? insets.bottom + 74;
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => toast.subscribe((t) => {
    setMsg(t);
    if (t) AccessibilityInfo.announceForAccessibility(t.text);
  }), []);

  useEffect(() => {
    if (!msg) return;
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
    }, msg.ms ?? 3000);
    return () => clearTimeout(timer);
  }, [msg, fade]);

  if (!msg) return null;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center', opacity: fade,
      transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      <View accessibilityLiveRegion="polite" style={{ borderRadius: 16, maxWidth: 440, marginHorizontal: 20, backgroundColor: HT.color.darkCard,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
        <NightSurface style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16,
          paddingLeft: 18, paddingRight: msg.action ? 6 : 18, minHeight: 52 }}>
          <T v="strong" style={{ color: HT.color.onDarkText, flexShrink: 1 }} numberOfLines={2}>{msg.text}</T>
          {msg.action ? (
            <Pressable accessibilityRole="button" onPress={() => { msg.action?.run(); setMsg(null); }}
              style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: HT.color.onDarkButton }}>
              <T v="strong" style={{ color: HT.color.glow }}>{msg.action.label}</T>
            </Pressable>
          ) : null}
        </NightSurface>
      </View>
    </Animated.View>
  );
}
