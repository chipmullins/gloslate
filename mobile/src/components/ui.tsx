import * as Haptics from 'expo-haptics';
import { forwardRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ButtonBunny } from '@/components/bunny-hop';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { formatCents } from '@/lib/money';

// ---------- Text ----------

const variants = StyleSheet.create({
  display: { fontFamily: HT.font.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: HT.color.ink },
  title: { fontFamily: HT.font.displayBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: HT.color.ink },
  heading: { fontFamily: HT.font.displayBold, fontSize: 15.5, lineHeight: 20, color: HT.color.ink },
  body: { fontFamily: HT.font.medium, fontSize: 15, lineHeight: 22, color: HT.color.ink },
  strong: { fontFamily: HT.font.bold, fontSize: 15, lineHeight: 22, color: HT.color.ink },
  muted: { fontFamily: HT.font.medium, fontSize: 13.5, lineHeight: 19, color: HT.color.muted },
  small: { fontFamily: HT.font.semibold, fontSize: 12, lineHeight: 16, color: HT.color.muted },
  label: { fontFamily: HT.font.bold, fontSize: 12.5, lineHeight: 16, color: HT.color.muted },
});

type Variant = keyof typeof variants;

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[variants[v], style]} />;
}

/** All money renders in DM Sans with tabular numbers, so digits line up. */
export function Money({ cents, size = 15, color = HT.color.ink, sign, style }: {
  cents: number; size?: number; color?: string; sign?: boolean; style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[{ fontFamily: size >= 28 ? HT.font.monoBold : HT.font.mono, fontSize: size, color,
        letterSpacing: size >= 28 ? -size * 0.03 : 0, fontVariant: ['tabular-nums'] }, style]}>
      {formatCents(cents, { sign })}
    </Text>
  );
}

// ---------- Layout ----------

/**
 * Safe-area screen with the Gloslate ground. Content is centered and capped so
 * it never stretches edge-to-edge on iPad / tablets / unfolded foldables.
 */
export function Screen({ children, scroll = true, maxWidth = HT.maxWidth.content, footer, background = HT.color.ground }: {
  children: ReactNode; scroll?: boolean; maxWidth?: number; footer?: ReactNode; background?: string;
}) {
  const { gutter } = useLayout();
  const inner = <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, flexGrow: 1 }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {inner}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingTop: 12 }}>{inner}</View>
        )}
        {footer ? (
          <View style={{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, paddingBottom: 12 }}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Faint static amber "fireflies" for night surfaces (decorative; no motion, so nothing to reduce). */
const FIREFLIES: { left: `${number}%`; top: `${number}%` }[] = [
  { left: '84%', top: '12%' },
  { left: '9%', top: '22%' },
  { left: '73%', top: '58%' },
  { left: '18%', top: '74%' },
];

function Fireflies() {
  return (
    <>
      {FIREFLIES.map((p, i) => (
        <View key={i} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: p.left, top: p.top, width: 5, height: 5, borderRadius: 2.5, backgroundColor: HT.color.glow,
            opacity: 0.5, shadowColor: HT.color.glow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
      ))}
    </>
  );
}

/**
 * The plum night sky: a diagonal gradient approximating the web's
 * radial-gradient(ellipse at 30% 0%, #4A2C5A, #2A1A33 55%, #140C18). Use it for every
 * dark/hero surface instead of a flat HT.color.darkCard background.
 */
export function NightSurface({ children, style, fireflies }: { children?: ReactNode; style?: StyleProp<ViewStyle>; fireflies?: boolean }) {
  const n = HT.color.night;
  return (
    <View style={[{ backgroundColor: n.base, overflow: 'hidden' }, style]}>
      <LinearGradient pointerEvents="none" colors={[n.top, n.base, n.edge]} locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      {fireflies ? <Fireflies /> : null}
      {children}
    </View>
  );
}

export function Card({ children, style, dark, fireflies }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean; fireflies?: boolean }) {
  const base = { borderRadius: HT.radius.card, padding: 20 };
  if (dark) return <NightSurface fireflies={fireflies} style={[base, style]}>{children}</NightSurface>;
  return <View style={[{ backgroundColor: HT.color.surface }, base, style]}>{children}</View>;
}

// ---------- Controls ----------

/** onDark = the amber glow action on night surfaces (Request, I paid); glass = the secondary action there. */
type ButtonKind = 'primary' | 'secondary' | 'onDark' | 'glass' | 'link';

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon, style, accessibilityLabel }: {
  title: string; onPress: () => void; kind?: ButtonKind; loading?: boolean; disabled?: boolean;
  icon?: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const palette = {
    primary: { bg: HT.color.brand, fg: '#FFFFFF', border: 'transparent' },
    secondary: { bg: HT.color.surface, fg: HT.color.ink, border: HT.color.chipBorder },
    onDark: { bg: HT.color.glow, fg: HT.color.onGlow, border: 'transparent' },
    glass: { bg: HT.color.onDarkButton, fg: HT.color.onDarkText, border: HT.color.onDarkBorder },
    link: { bg: 'transparent', fg: HT.color.brand, border: 'transparent' },
  }[kind];
  const glow = kind === 'onDark'
    ? { shadowColor: HT.color.glow, shadowOpacity: 0.4, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } }
    : null;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: kind === 'link' ? HT.minTouch : 54,
          borderRadius: HT.radius.button,
          backgroundColor: palette.bg,
          borderWidth: kind === 'secondary' || kind === 'glass' ? 1 : 0,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && kind !== 'link' ? 0.985 : 1 }],
        },
        glow,
        style,
      ]}>
      {loading ? <ButtonBunny color={palette.fg} eye={palette.bg === 'transparent' ? undefined : palette.bg} /> : icon}
      <Text
        maxFontSizeMultiplier={1.4}
        style={{ fontFamily: HT.font.extrabold, fontSize: 15.5, color: palette.fg,
          textDecorationLine: kind === 'link' ? 'underline' : 'none' }}>
        {title}
      </Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInputInstance, TextInputProps & { label: string; hint?: string; error?: string | null; hideLabel?: boolean }>(
  function Field({ label, hint, error, hideLabel, style, ...rest }, ref) {
    return (
      <View style={{ gap: 6 }}>
        {hideLabel ? null : <T v="label" nativeID={`${label}-label`}>{label}</T>}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={hideLabel ? undefined : `${label}-label`}
          placeholderTextColor={HT.color.faint}
          maxFontSizeMultiplier={1.5}
          {...rest}
          style={[
            {
              // A fixed height (not minHeight): iOS otherwise resizes single-line inputs as you
              // type, because the custom font's placeholder and text metrics differ.
              height: 58, paddingVertical: 0, borderRadius: HT.radius.tile, borderWidth: 1,
              borderColor: error ? HT.color.danger : HT.color.chipBorder, backgroundColor: HT.color.surface,
              paddingHorizontal: 18, fontFamily: HT.font.semibold, fontSize: 17, color: HT.color.ink,
            },
            style,
          ]}
        />
        {error ? <T v="small" style={{ color: HT.color.danger }}>{error}</T> : hint ? <T v="small">{hint}</T> : null}
      </View>
    );
  },
);

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: '#FDECEA', borderRadius: 12, padding: 12 }}>
      <T v="strong" style={{ color: HT.color.danger, fontSize: 14 }}>{message}</T>
    </View>
  );
}

export function Avatar({ name, index = 0, size = 44 }: { name: string; index?: number; size?: number }) {
  const c = HT.color.avatar[index % HT.color.avatar.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: HT.font.displayBold, fontSize: size * 0.36, color: c.fg }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, backgroundColor: HT.color.surface,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}

/** Small step indicator for first-run screens. */
export function Steps({ total, current }: { total: number; current: number }) {
  return (
    <View accessibilityLabel={`Step ${current} of ${total}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: i < current ? HT.color.brand : HT.color.segment }} />
      ))}
    </View>
  );
}
