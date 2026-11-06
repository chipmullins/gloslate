import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupIcon } from '@/components/group-icons';
import { ChevronIcon, SendIcon } from '@/components/icons';
import { Avatar, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import type { HouseholdSummary } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Words for a balance: "Jordan owes you" / "You owe Jordan" / "Settled". */
function balanceLine(g: HouseholdSummary, oneOnOne: boolean) {
  const net = g.balance.net_cents;
  const name = g.people?.[0] ?? 'them';
  if (net === 0) return { text: 'Settled', color: HT.color.muted };
  if (oneOnOne) return net > 0 ? { text: `${name} owes you`, color: HT.color.owedToYou } : { text: `You owe ${name}`, color: HT.color.youOwe };
  return net > 0 ? { text: "You're owed", color: HT.color.owedToYou } : { text: 'You owe', color: HT.color.youOwe };
}

function Action({ icon, title, sub, onPress }: { icon: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingHorizontal: 16,
        borderRadius: HT.radius.card, backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T v="strong">{title}</T>
        <T v="small">{sub}</T>
      </View>
      <ChevronIcon size={18} color={HT.color.muted} />
    </Pressable>
  );
}

/** Everyone outside your home: one-on-one tabs with a person, and groups that settle together. */
export default function Friends() {
  const { households, refresh } = useSession();
  const { gutter, wide } = useLayout();
  const all = households.filter((h) => h.kind === 'group');
  const people = all.filter((h) => h.member_count === 2);
  const groups = all.filter((h) => h.member_count !== 2);
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  const row = (g: HouseholdSummary, i: number, list: HouseholdSummary[], oneOnOne: boolean) => {
    const line = balanceLine(g, oneOnOne);
    const title = oneOnOne ? g.people?.[0] ?? g.name : g.name;
    const sub = oneOnOne ? 'One-on-one' : `${g.member_count} people${g.people?.length ? ` · ${g.people.slice(0, 3).join(', ')}${g.member_count > 4 ? '…' : ''}` : ''}`;
    return (
      <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`${title}, ${line.text}${g.balance.net_cents ? ` ${Math.abs(g.balance.net_cents) / 100} dollars` : ''}`}
        onPress={() => router.push(`/group/${g.id}` as Href)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1,
          borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline })}>
        {oneOnOne ? (
          <Avatar name={title} index={(i % 4) + 1} size={44} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon size={22} color={HT.color.brand} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T v="strong" numberOfLines={1}>{title}</T>
          <T v="small" numberOfLines={1}>{sub}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="small" style={{ color: line.color }}>{line.text}</T>
          {g.balance.net_cents !== 0 ? <Money cents={Math.abs(g.balance.net_cents)} size={16} color={line.color} /> : null}
        </View>
        <ChevronIcon size={18} color={HT.color.muted} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.form + (wide ? 240 : 0), alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <T v="display" accessibilityRole="header">Friends</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Action icon={<SendIcon size={18} color={HT.color.brand} />} title="Settle up with someone" sub="One person owes the other" onPress={() => router.push('/request-friend' as Href)} />
            <Action icon={<GroupIcon size={22} color={HT.color.brand} />} title="Start a group" sub="A trip, dinners, anything shared" onPress={() => router.push('/group/new' as Href)} />
          </View>

          {all.length === 0 ? (
            <Card style={{ gap: 8, paddingVertical: 22 }}>
              <T v="heading" style={{ fontSize: 17 }}>Split with anyone, not just roommates</T>
              <T v="muted">
                Covered lunch for a co-worker? Settle up with just them. Going on a trip? Start a group: everyone adds what they paid, even when two people split the hotel, and Gloslate finds the fewest payments to settle everyone.
              </T>
            </Card>
          ) : null}

          {people.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T v="heading">People</T>
              <Card style={{ paddingVertical: 4 }}>{people.map((g, i) => row(g, i, people, true))}</Card>
            </View>
          ) : null}

          {groups.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T v="heading">Groups</T>
              <Card style={{ paddingVertical: 4 }}>{groups.map((g, i) => row(g, i, groups, false))}</Card>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
