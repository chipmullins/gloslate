import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { Section, Segmented, SettingsPage, useMySettings } from '@/components/settings';
import { Button, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { celebrate } from '@/lib/celebrate';
import { canMatchPhone, theme, type ThemePref } from '@/lib/theme';

const CLEAN_SLATE_STYLES = [
  { key: 'full', label: 'Full screen', hint: 'The whole screen turns to night sky (default)' },
  { key: 'card', label: 'Card', hint: 'A card at the top; the screen stays put' },
  { key: 'sheet', label: 'Bottom sheet', hint: 'Slides up from the bottom' },
] as const;

export default function AppearanceSettings() {
  const { user, error, patchMe } = useMySettings();
  const [pref, setPref] = useState<ThemePref>(theme.pref);
  if (!user) return null;
  const options: { key: ThemePref; label: string }[] = [
    ...(canMatchPhone ? [{ key: 'system' as const, label: 'Match phone' }] : []),
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];
  return (
    <SettingsPage title="Appearance" error={error}>
      <Section title="Theme">
        <Segmented label="Theme" value={pref} options={options} onChange={(p) => { setPref(p); theme.set(p); }} />
        <T v="small">{canMatchPhone ? 'Match phone follows your phone’s dark mode.' : 'Saved on this device.'}</T>
      </Section>

      <Section title="Clean slate moment">
        <T v="small">What you see when a payment you confirm leaves you square with someone.</T>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {CLEAN_SLATE_STYLES.map((o) => {
            const on = (user.celebration_style ?? 'full') === o.key;
            return (
              <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${o.label}. ${o.hint}`}
                onPress={() => { if (!on) patchMe({ celebration_style: o.key }, 'Saved'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: HT.radius.tile,
                  borderWidth: on ? 1.5 : 1, borderColor: on ? HT.color.brand : HT.color.chipBorder, backgroundColor: on ? HT.color.brandTint : HT.color.surface }}>
                <View style={{ flex: 1 }}>
                  <T v="strong" style={{ color: on ? HT.color.brand : HT.color.ink }}>{o.label}</T>
                  <T v="small">{o.hint}</T>
                </View>
                {on ? <CheckIcon size={18} color={HT.color.brand} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Button title="Preview" kind="secondary" onPress={() => celebrate.show({ title: 'Clean slate with Alex.', body: "Alex's $24.50 is confirmed. Nothing owed either way.", amountCents: 2450, style: user.celebration_style ?? 'full' })} />
      </Section>
    </SettingsPage>
  );
}
