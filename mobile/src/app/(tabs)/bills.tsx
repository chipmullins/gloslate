import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shortDate } from '@/components/expense-row';
import { ChevronIcon, PlusIcon } from '@/components/icons';
import { SetUpHomeCard } from '@/components/no-home';
import { ordinal } from '@/components/stepper';
import { Button, Card, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, type Bill, type BillCycle, type Household } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';

export default function Bills() {
  const { households } = useSession();
  const { wide, gutter } = useLayout();
  const id = households.find((h) => h.kind !== 'group')?.id;
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [coming, setComing] = useState<BillCycle[]>([]);
  const [home, setHome] = useState<Household | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [b, h] = await Promise.all([
      api<{ data: Bill[]; coming_up: BillCycle[] }>(`/v1/households/${id}/bills`),
      api<{ data: Household }>(`/v1/households/${id}`),
    ]);
    setBills(b.data);
    setComing(b.coming_up);
    setHome(h.data);
  }, [id]);
  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  const nameOf = (mid: string) => { const m = home?.members.find((x) => x.id === mid); return m ? (m.you ? 'You' : m.first_name) : ''; };
  const needs = coming.filter((c) => c.status === 'waiting');

  const needsBlock = needs.length > 0 ? (
    <View style={{ gap: 8 }}>
      <T v="heading">Waiting for an amount</T>
      {needs.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/bill-cycle/${c.id}` as Href)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.missing ? '#FBEBDD' : HT.color.brandTint,
            borderRadius: HT.radius.tile, padding: 14, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ flex: 1 }}>
            <T v="strong" style={{ color: c.missing ? HT.color.youOwe : HT.color.brand }}>{c.name} {c.missing ? 'amount missing' : 'bill in?'}</T>
            <T v="small">{c.you_pay ? 'Enter the amount and Gloslate splits it' : `${nameOf(c.payer_id)} enters this one`}</T>
          </View>
          <ChevronIcon size={18} color={c.missing ? HT.color.youOwe : HT.color.brand} />
        </Pressable>
      ))}
    </View>
  ) : null;

  const upcoming = (
    <View style={{ gap: 8 }}>
      <T v="heading">Next up</T>
      <Card style={{ paddingVertical: 4 }}>
        {coming.filter((c) => c.status === 'upcoming').length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Nothing scheduled</T> : null}
        {coming.filter((c) => c.status === 'upcoming').slice(0, 8).map((c, i, arr) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/bill-cycle/${c.id}` as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <View style={{ flex: 1 }}>
              <T v="strong">{c.name}</T>
              <T v="small">{c.kind === 'fixed' ? 'Posts' : 'Expected'} {shortDate(c.due_on)}{c.overridden ? ' · this month only' : ''}</T>
            </View>
            {c.amount_cents ? <T v="strong" style={{ fontFamily: HT.font.mono }}>{formatCents(c.amount_cents)}</T> : <T v="small">varies</T>}
          </Pressable>
        ))}
      </Card>
    </View>
  );

  const list = (
    <View style={{ gap: 8 }}>
      <T v="heading">Your bills</T>
      {bills && bills.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
          <T v="strong">No bills yet</T>
          <T v="muted" style={{ textAlign: 'center', maxWidth: 320 }}>Set up rent and utilities once. Each one posts itself when it's due.</T>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {(bills ?? []).map((b, i, arr) => (
            <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={b.can_manage ? `Edit ${b.name}` : b.name} disabled={!b.can_manage}
              onPress={() => router.push(`/bill-edit?id=${b.id}` as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
              <View style={{ flex: 1 }}>
                <T v="strong">{b.name}</T>
                <T v="small">{b.kind === 'fixed' ? `${formatCents(b.amount_cents ?? 0)} on the ${ordinal(b.due_day)}` : `Varies · around the ${ordinal(b.due_day)}`} · {nameOf(b.payer_id)} pay{b.you_pay ? '' : 's'} it</T>
              </View>
              {b.can_manage ? <ChevronIcon size={18} color={HT.color.muted} /> : null}
            </Pressable>
          ))}
        </Card>
      )}
      <Button title="Add a bill" kind="secondary" icon={<PlusIcon size={16} />} onPress={() => router.push('/bill-edit' as Href)} />
    </View>
  );

  if (!id) {
    // Bills belong to a home (rent, utilities that repeat monthly).
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={{ width: '100%', maxWidth: HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 18 }}>
            <T v="display" accessibilityRole="header">Bills</T>
            <SetUpHomeCard title="Bills are for a home" body="Rent and utilities you split every month live here. Set up your home and each bill posts itself when it's due. For a one-off with a friend, use Friends." />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load().catch(() => {}); setRefreshing(false); }} tintColor={HT.color.brand} />}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 18 }}>
          <T v="display" accessibilityRole="header">Bills</T>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 18 }}>{needsBlock}{upcoming}</View>
              <View style={{ flex: 1, gap: 18 }}>{list}</View>
            </View>
          ) : (
            <>{needsBlock}{list}{upcoming}</>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
