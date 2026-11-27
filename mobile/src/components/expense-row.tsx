import { Pressable, View } from 'react-native';

import { Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { categoryLabel, type Expense, type Member } from '@/lib/api';
import { formatCents } from '@/lib/money';

export function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ExpenseRow({ e, members, onPress, last }: { e: Expense; members: Member[]; onPress: () => void; last?: boolean }) {
  const payer = members.find((m) => m.id === e.payer_id);
  const several = (e.payers?.length ?? 0) > 1;
  const payerNames = (e.payers ?? []).map((p) => members.find((m) => m.id === p.member_id)).map((m) => (m?.you ? 'you' : m?.first_name ?? 'Former member'));
  const who = several
    ? `${payerNames.length > 2 ? `${payerNames.length} people` : payerNames.join(' & ')} paid`
    : payer?.you ? 'you paid' : `${payer?.first_name ?? 'Former member'} paid`;
  const inIt = e.shares.some((s) => s.cents > 0 && members.find((m) => m.id === s.member_id)?.you) || (e.payers ?? []).some((p) => members.find((m) => m.id === p.member_id)?.you);
  const color = e.effect_for_me_cents > 0 ? HT.color.owedToYou : e.effect_for_me_cents < 0 ? HT.color.youOwe : HT.color.muted;
  const title = e.description || categoryLabel(e.category);
  const tile = HT.color.avatar[[...e.category].reduce((n, c) => n + c.charCodeAt(0), 0) % HT.color.avatar.length];
  // Say it in words ("Coleman owes you") instead of a bare +/− number.
  const name = (id: string) => members.find((m) => m.id === id)?.first_name ?? 'Former member';
  const others = e.shares.filter((s) => s.cents > 0 && s.member_id !== e.payer_id && !members.find((m) => m.id === s.member_id)?.you);
  const caption = several
    ? (e.effect_for_me_cents > 0 ? "You're owed" : e.effect_for_me_cents < 0 ? 'You owe' : null)
    : e.effect_for_me_cents > 0
      ? (others.length === 1 ? `${name(others[0].member_id)} owes you` : `${others.length} people owe you`)
      : e.effect_for_me_cents < 0 ? `You owe ${name(e.payer_id)}` : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${shortDate(e.spent_on)}, ${who}${caption ? `, ${caption} ${formatCents(Math.abs(e.effect_for_me_cents))}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56,
        paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: HT.color.hairline, opacity: pressed ? 0.6 : 1 })}>
      {/* Tinted letter tile (pill bar redesign); the tint follows the category so rows stay steady. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 42, height: 42, borderRadius: HT.radius.tile, backgroundColor: tile.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontFamily: HT.font.displayExtra, fontSize: 17, color: tile.fg }}>{(title.trim()[0] ?? '·').toUpperCase()}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T v="strong" numberOfLines={1}>{title}</T>
        <T v="small">{shortDate(e.spent_on)} · {who}{e.edited ? ' · edited' : ''}{e.urgency === 'soon' ? ' · pay back soon' : ''}</T>
      </View>
      {e.effect_for_me_cents === 0 ? (
        <T v="small">{inIt ? 'even' : 'not in it'}</T>
      ) : (
        <View style={{ alignItems: 'flex-end', gap: 1 }}>
          <T v="small" style={{ color, fontFamily: HT.font.bold, fontSize: 12 }}>{caption}</T>
          <Money cents={Math.abs(e.effect_for_me_cents)} color={color} />
        </View>
      )}
    </Pressable>
  );
}
