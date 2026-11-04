import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { BackspaceIcon } from '@/components/icons';
import { HT } from '@/constants/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Applies a key to a dollar string: max 7 whole digits, 2 decimals. */
export function applyKey(value: string, key: string): string {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const [whole, dec] = value.split('.');
  if (dec !== undefined) return dec.length >= 2 ? value : value + key;
  if (whole === '0') return key;
  return whole.length >= 7 ? value : value + key;
}

export function Keypad({ onKey, onClear, compact }: { onKey: (k: string) => void; onClear: () => void; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k === 'del' ? 'Delete digit' : k === '.' ? 'Decimal point' : k}
          accessibilityHint={k === 'del' ? 'Hold to clear' : undefined}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onKey(k); }}
          onLongPress={k === 'del' ? onClear : undefined}
          style={({ pressed }) => ({
            flexBasis: '31%', flexGrow: 1, minHeight: compact ? 48 : 54, borderRadius: HT.radius.tile,
            backgroundColor: pressed ? HT.color.segment : HT.color.surface, alignItems: 'center', justifyContent: 'center',
          })}>
          {k === 'del' ? (
            <BackspaceIcon size={24} />
          ) : (
            <Text style={{ fontFamily: HT.font.mono, fontSize: 24, color: HT.color.ink }}>{k}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
