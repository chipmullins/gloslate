import { Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { HT } from '@/constants/theme';

/** − value + control with real buttons (44pt) for small integers like a due day. */
export function Stepper({ label, value, min, max, onChange, format }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const btn = (txt: string, next: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={next < min || next > max} onPress={() => onChange(next)}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, backgroundColor: HT.color.segment, alignItems: 'center', justifyContent: 'center',
        opacity: next < min || next > max ? 0.35 : pressed ? 0.6 : 1 })}>
      <T v="title" style={{ fontSize: 20, lineHeight: 24 }}>{txt}</T>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: format ? format(value) : String(value) }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: HT.color.surface, borderRadius: HT.radius.tile, borderWidth: 1, borderColor: HT.color.chipBorder, padding: 4 }}>
        {btn('−', value - 1, `Decrease ${label}`)}
        <T v="strong" style={{ flex: 1, textAlign: 'center' }}>{format ? format(value) : value}</T>
        {btn('+', value + 1, `Increase ${label}`)}
      </View>
    </View>
  );
}

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
