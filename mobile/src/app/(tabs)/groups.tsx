import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupIcon } from '@/components/group-icons';
import { ChevronIcon, PlusIcon, SendIcon } from '@/components/icons';
import { Button, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import type { HouseholdSummary } from '@/lib/api';
import { useSession } from '@/lib/session';

/** One line for a group's balance: what you're owed or owe across it. */
function balanceLine(g: HouseholdSummary) {
  const net = g.balance.net_cents;
  if (net === 0) return { text: 'All settled', color: HT.color.muted };
  return net > 0 ? { text: "You're owed", color: HT.color.owedToYou } : { text: 'You owe', color: HT.color.youOwe };
}

/** Trips, dinners and friends outside your home. */
export default function Groups() {
  const { households, refresh } = useSession();
  const { gutter, wide } = useLayout();
  const groups = households.filter((h) => h.kind === 'group');
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.form + (wide ? 160 : 0), alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="display" accessibilityRole="header">Groups</T>
            {groups.length > 0 ? (
              <Button title="New group" icon={<PlusIcon size={16} color="#FFFFFF" />} onPress={() => router.push('/group/new' as Href)} style={{ paddingHorizontal: 18 }} />
            ) : null}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Someone owes you? Send a quick request" onPress={() => router.push('/request-friend' as Href)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, borderRadius: HT.radius.card,
              backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline, opacity: pressed ? 0.75 : 1 })}>
            <View style={{ width: 40, height: 40, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <SendIcon size={18} color={HT.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="strong">Someone owes you?</T>
              <T v="small">Send a quick request to a friend</T>
            </View>
            <ChevronIcon size={18} color={HT.color.muted} />
          </Pressable>

          {groups.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <GroupIcon size={32} color={HT.color.brand} />
              </View>
              <T v="heading" style={{ fontSize: 18, textAlign: 'center' }}>Split a trip, a dinner or anything with friends</T>
              <T v="muted" style={{ textAlign: 'center', maxWidth: 340 }}>
                Everyone adds what they paid, even if several people paid for one thing. Gloslate works out the fewest payments to settle up.
              </T>
              <Button title="Start a group" icon={<PlusIcon size={16} color="#FFFFFF" />} onPress={() => router.push('/group/new' as Href)} style={{ alignSelf: 'stretch', marginTop: 6 }} />
            </Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {groups.map((g, i) => {
                const line = balanceLine(g);
                return (
                  <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`${g.name}, ${g.member_count} people, ${line.text}`}
                    onPress={() => router.push(`/group/${g.id}` as Href)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1,
                      borderBottomWidth: i < groups.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline })}>
                    <View style={{ width: 44, height: 44, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <GroupIcon size={22} color={HT.color.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="strong" numberOfLines={1}>{g.name}</T>
                      <T v="small">{g.member_count} people</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T v="small" style={{ color: line.color }}>{line.text}</T>
                      {g.balance.net_cents !== 0 ? <Money cents={Math.abs(g.balance.net_cents)} size={16} color={line.color} /> : null}
                    </View>
                    <ChevronIcon size={18} color={HT.color.muted} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
