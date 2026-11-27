import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HT } from '@/constants/theme';

/** Height of the pill itself (6pt padding around 48pt items). */
const PILL = 60;
const GAP_BELOW = 10;

/** Room a tab screen leaves at the bottom so its last row scrolls clear of the floating bar. */
export function useTabBarInset() {
  const { bottom } = useSafeAreaInsets();
  return PILL + Math.max(bottom, 12) + GAP_BELOW + 20;
}

export type PillTab = { name: string; title: string; icon: (color: string) => ReactNode; badge?: number; a11y?: string };

/**
 * The floating dark pill bar (canvas "Gloslate · Pill bar redesign"): the tab you're on is a violet
 * pill with its icon and name, the others are icons. Same press rules as the stock bar: tabPress is
 * emitted first (so a second tap still scrolls a screen to the top), then it switches tabs.
 */
export function PillTabBar({ state, descriptors, emitter, navigateToTab, tabs }: BottomTabBarProps & { tabs: PillTab[] }) {
  const { bottom } = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    // The bar floats, so on Android it would ride up on the keyboard: hide it while typing (Activity search).
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(bottom, 12) + GAP_BELOW, alignItems: 'center' }}>
      <View accessibilityRole="tablist"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6, borderRadius: PILL / 2, backgroundColor: HT.color.bar,
          borderWidth: HT.scheme === 'dark' ? 1 : 0, borderColor: HT.color.onDarkBorder,
          shadowColor: '#140C18', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
        {state.routes.map((route, index) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => { emitter.emit({ type: 'tabLongPress', target: route.key }); };
          const badge = tab.badge ? (
            <View style={{ position: 'absolute', top: -7, right: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
              backgroundColor: HT.color.youOwe, borderWidth: 2, borderColor: HT.color.bar, alignItems: 'center', justifyContent: 'center' }}>
              <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: HT.font.bold, fontSize: 10, color: '#FFFFFF' }}>{tab.badge}</Text>
            </View>
          ) : null;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.a11y ?? tab.title}
              testID={options.tabBarButtonTestID} onPress={onPress} onLongPress={onLongPress} hitSlop={4}
              style={({ pressed }) => ({ height: 48, minWidth: 46, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 7, paddingLeft: focused ? 14 : 0, paddingRight: focused ? 17 : 0, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              {focused ? (
                <LinearGradient pointerEvents="none" colors={[HT.color.accent, HT.color.accentDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
              ) : null}
              <View style={{ zIndex: 1 }}>{tab.icon(focused ? HT.color.onAccent : HT.color.barIcon)}{badge}</View>
              {focused ? (
                <Text numberOfLines={1} maxFontSizeMultiplier={1.15}
                  style={{ fontFamily: HT.font.displayBold, fontSize: 14.5, color: HT.color.onAccent }}>{tab.title}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
