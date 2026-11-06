import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { BackspaceIcon } from '@/components/icons';
import { HT } from '@/constants/theme';
import { centsFirst } from '@/lib/money';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

/**
 * Applies a key cash-register style: digits fill in from the cents, so "1 2 3 4"
 * reads $12.34 and nobody types a decimal point. "00" adds two zeros ($12 → 1 2 00).
 */
export function applyKey(value: string, key: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (key === 'del') return centsFirst(digits.slice(0, -1));
  return centsFirst(digits + key);
}

export function Keypad({ onKey, onClear, compact }: { onKey: (k: string) => void; onClear: () => void; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k === 'del' ? 'Delete digit' : k === '00' ? 'Double zero' : k}
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
            <Text style={{ fontFamily: HT.font.mono, fontSize: 24, color: HT.color.ink, fontVariant: ['tabular-nums'] }}>{k}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
