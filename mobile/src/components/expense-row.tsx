import { Pressable, View } from 'react-native';

import { Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { categoryLabel, type Expense, type Member } from '@/lib/api';

export function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ExpenseRow({ e, members, onPress, last }: { e: Expense; members: Member[]; onPress: () => void; last?: boolean }) {
  const payer = members.find((m) => m.id === e.payer_id);
  const who = payer?.you ? 'you paid' : `${payer?.first_name ?? 'Former member'} paid`;
  const color = e.effect_for_me_cents > 0 ? HT.color.owedToYou : e.effect_for_me_cents < 0 ? HT.color.youOwe : HT.color.muted;
  const title = e.description || categoryLabel(e.category);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${shortDate(e.spent_on)}, ${who}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56,
        paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: HT.color.hairline, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <T v="strong" numberOfLines={1}>{title}</T>
        <T v="small">{shortDate(e.spent_on)} · {who}{e.edited ? ' · edited' : ''}{e.urgency === 'soon' ? ' · pay back soon' : ''}</T>
      </View>
      {e.effect_for_me_cents === 0 ? (
        <T v="small">not in it</T>
      ) : (
        <Money cents={e.effect_for_me_cents} sign color={color} />
      )}
    </Pressable>
  );
}
