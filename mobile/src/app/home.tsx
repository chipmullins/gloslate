import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ExpenseRow } from '@/components/expense-row';
import { HouseMark, PlusIcon, ShareIcon } from '@/components/icons';
import { ToastHost } from '@/components/toast-host';
import { Avatar, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Expense, type Household, type Member } from '@/lib/api';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

function names(members: Member[]) {
  const others = members.filter((m) => !m.you && !m.former).map((m) => m.first_name);
  if (others.length === 0) return 'Just you';
  if (others.length === 1) return `You & ${others[0]}`;
  return `You, ${others.slice(0, -1).join(', ')} & ${others.at(-1)}`;
}

export default function Home() {
  const { households } = useSession();
  const { wide, gutter } = useLayout();
  const [home, setHome] = useState<Household | null>(null);
  const [recentItems, setRecentItems] = useState<Expense[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = households[0]?.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [res, items] = await Promise.all([
        api<{ data: Household }>(`/v1/households/${id}`),
        api<{ data: Expense[] }>(`/v1/households/${id}/expenses?limit=8`),
      ]);
      setHome(res.data);
      setRecentItems(items.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => toast.subscribe((t) => { if (t && !t.action) setTimeout(load, 300); }), [load]);

  async function invite(member?: Member) {
    if (!home) return;
    try {
      const res = await api<{ data: { url: string; message: string } }>(`/v1/households/${home.id}/invites`, {
        body: member ? { member_id: member.id } : {},
      });
      await Share.share({ message: res.data.message, url: res.data.url });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't make an invite link.");
    }
  }

  if (!home) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }}>{error ? <T style={{ padding: 20 }}>{error}</T> : null}</SafeAreaView>;
  }

  const byId = new Map(home.members.map((m, i) => [m.id, { ...m, index: i }]));
  const waiting = home.members.filter((m) => m.placeholder && !m.former);
  const others = home.members.filter((m) => !m.you && !m.former);
  const net = home.balance.net_cents;
  const couple = others.length === 1;
  const partner = others[0];

  const headline =
    net === 0 ? "You're all square" : couple && partner ? (net > 0 ? `${partner.first_name} owes you` : `You owe ${partner.first_name}`)
      : net > 0 ? "You're owed" : 'You owe';

  const balanceCard = (
    <Card dark style={{ alignItems: 'center', gap: 8, paddingTop: 24, paddingBottom: 20 }}>
      {couple && partner ? <Avatar name={partner.first_name} index={byId.get(partner.id)?.index ?? 1} /> : null}
      <T v="strong" style={{ color: HT.color.darkCardMuted, fontSize: 14 }}>{headline}</T>
      <Money cents={Math.abs(net)} size={wide ? 56 : 48} color="#FFFFFF" />
      <T v="small" style={{ color: HT.color.darkCardMuted, textAlign: 'center' }}>
        {net === 0 ? 'Nothing owed either way. Log the next expense and HomeTab does the math.' : 'Everything netted out, already subtracted both ways'}
      </T>

      {!couple && home.balance.with.length > 0 ? (
        <View style={{ alignSelf: 'stretch', marginTop: 10, borderTopWidth: 1, borderTopColor: '#2A3830', paddingTop: 8 }}>
          {home.balance.with.map((w) => {
            const m = byId.get(w.member_id);
            if (!m) return null;
            return (
              <View key={w.member_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <Avatar name={m.first_name} index={m.index} size={32} />
                <T v="strong" style={{ color: '#FFFFFF', flex: 1 }}>{w.cents > 0 ? `${m.first_name} owes you` : `You owe ${m.first_name}`}</T>
                <Money cents={Math.abs(w.cents)} color={w.cents > 0 ? '#7FD3A8' : '#F2A66B'} />
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );

  const invitePanel = waiting.length > 0 ? (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <T v="heading">{waiting.length === 1 ? `Invite ${waiting[0].first_name}` : 'Invite your roommates'}</T>
        <T v="muted">
          You can log things now. When {waiting.length === 1 ? waiting[0].first_name : 'they'} join{waiting.length === 1 ? 's' : ''}, everything you've added shows up for them.
        </T>
      </View>
      {waiting.map((m) => (
        <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`Send ${m.first_name} an invite link`} onPress={() => invite(m)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderRadius: HT.radius.tile,
            backgroundColor: HT.color.brandTint, paddingHorizontal: 12, opacity: pressed ? 0.75 : 1 })}>
          <Avatar name={m.first_name} index={byId.get(m.id)?.index ?? 1} size={34} />
          <T v="strong" style={{ flex: 1, color: HT.color.brand }}>Send {m.first_name} a link</T>
          <ShareIcon size={18} color={HT.color.brand} />
        </Pressable>
      ))}
    </Card>
  ) : null;

  const recent = (
    <View style={{ gap: 8 }}>
      <T v="heading">Recent</T>
      {recentItems && recentItems.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>
          {recentItems.map((e, i) => (
            <ExpenseRow key={e.id} e={e} members={home.members} last={i === recentItems.length - 1}
              onPress={() => router.push(`/expense/${e.id}` as Href)} />
          ))}
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
          <T v="strong">Nothing logged yet</T>
          <T v="muted" style={{ textAlign: 'center', maxWidth: 320 }}>Add the rent, tonight's dinner, or the last grocery run. Three taps.</T>
        </Card>
      )}
    </View>
  );

  const people = (
    <View style={{ gap: 8 }}>
      <T v="heading">Home</T>
      <Card style={{ paddingVertical: 6 }}>
        {home.members.filter((m) => !m.former).map((m, i, arr) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
            borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <Avatar name={m.first_name} index={byId.get(m.id)?.index ?? i} size={36} />
            <View style={{ flex: 1 }}>
              <T v="strong">{m.you ? `${m.display_name} (you)` : m.display_name}</T>
              <T v="small">{m.placeholder ? 'Not joined yet' : Object.keys(m.handles).length ? Object.keys(m.handles).map((k) => ({ venmo: 'Venmo', cashapp: 'Cash App', zelle: 'Zelle' } as Record<string, string>)[k]).join(' · ') : 'No payment apps added'}</T>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={HT.color.brand} />}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 12, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HouseMark size={34} />
              <View>
                <T v="title" style={{ fontSize: 19, lineHeight: 23 }} accessibilityRole="header">HomeTab</T>
                <T v="small">{names(home.members)}</T>
              </View>
            </View>
            {home.members.filter((m) => !m.former).length < 5 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Invite a roommate" onPress={() => invite()}
                style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: HT.color.chipBorder,
                  backgroundColor: HT.color.surface, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <PlusIcon size={14} />
                <T v="strong" style={{ fontSize: 13 }}>Invite</T>
              </Pressable>
            ) : null}
          </View>

          {error ? <T v="small" style={{ color: HT.color.danger }}>{error}</T> : null}

          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 5, gap: 18 }}>{balanceCard}{invitePanel}</View>
              <View style={{ flex: 6, gap: 18 }}>{recent}{people}</View>
            </View>
          ) : (
            <>
              {balanceCard}
              {invitePanel}
              {recent}
              {people}
            </>
          )}
        </View>
      </ScrollView>
      <ToastHost bottom={104} />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28, paddingTop: 36, alignItems: 'center' }}>
        <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={HT.color.ground} stopOpacity={0} />
              <Stop offset="0.45" stopColor={HT.color.ground} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
        <Pressable accessibilityRole="button" accessibilityLabel="Add an expense" onPress={() => router.push('/add' as Href)}
          style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 36, borderRadius: HT.radius.pill, backgroundColor: HT.color.brand,
            flexDirection: 'row', alignItems: 'center', gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: HT.color.brand, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
          <PlusIcon size={20} color="#FFFFFF" />
          <T v="strong" style={{ color: '#FFFFFF', fontSize: 16, fontFamily: HT.font.extrabold }}>Add</T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
