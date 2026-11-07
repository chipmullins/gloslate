import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmPayments, NotificationBell } from '@/components/confirm-payments';
import { ExpenseRow, shortDate } from '@/components/expense-row';
import { ChevronIcon, HouseMark, PlusIcon, SendIcon, ShareIcon, SparkleIcon } from '@/components/icons';
import { FullScreenLoader } from '@/components/bunny-loader';
import { Avatar, Button, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type BillCycle, type Expense, type Household, type Member, type Payment } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';
import { shareLink } from '@/lib/share';
import { updateBalanceWidget } from '@/widgets/balance';

function names(members: Member[]) {
  const others = members.filter((m) => !m.you && !m.former).map((m) => m.first_name);
  if (others.length === 0) return 'Just you';
  if (others.length === 1) return `You & ${others[0]}`;
  return `You, ${others.slice(0, -1).join(', ')} & ${others.at(-1)}`;
}

export async function sendRequest(householdId: string, memberId: string, name?: string) {
  const res = await api<{ data: { url: string; message: string; in_app?: boolean; amount_cents: number } }>(`/v1/households/${householdId}/requests`, { body: { member_id: memberId } });
  if (res.data.in_app) {
    // They have Gloslate: it already reached them as a notification.
    toast.show({ text: `Sent ${formatCents(res.data.amount_cents)} request${name ? ` to ${name}` : ''} in Gloslate.`, ms: 5000,
      action: { label: 'Text it too', run: () => { shareLink(res.data.message, res.data.url).catch(() => {}); } } });
    return;
  }
  await shareLink(res.data.message, res.data.url);
}

type HomeSnapshot = { home: Household | null; recent: Expense[] | null; coming: BillCycle[]; pending: Payment[]; unread: number };
const EMPTY: HomeSnapshot = { home: null, recent: null, coming: [], pending: [], unread: 0 };
const homeCache = new Map<string, HomeSnapshot>(); // per home, so another account never sees it

export default function Home() {
  const { households } = useSession();
  const { wide, gutter } = useLayout();
  // Start from what we showed last time (instant when switching tabs or reopening), then refresh.
  const [snap] = useState(() => homeCache.get(households.find((h) => h.kind !== 'group')?.id ?? '') ?? EMPTY);
  const [home, setHome] = useState<Household | null>(snap.home);
  const [recent, setRecent] = useState<Expense[] | null>(snap.recent);
  const [coming, setComing] = useState<BillCycle[]>(snap.coming);
  const [pending, setPending] = useState<Payment[]>(snap.pending);
  const [unread, setUnread] = useState(snap.unread);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = households.find((h) => h.kind !== 'group')?.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [h, items, bills, pays, inbox] = await Promise.all([
        api<{ data: Household }>(`/v1/households/${id}`),
        api<{ data: Expense[] }>(`/v1/households/${id}/expenses?limit=8`),
        api<{ coming_up: BillCycle[] }>(`/v1/households/${id}/bills`),
        api<{ data: Payment[] }>(`/v1/households/${id}/payments?status=pending`),
        api<{ unread: number }>('/v1/notifications'),
      ]);
      const mine = pays.data.filter((p) => p.can_confirm);
      homeCache.set(id, { home: h.data, recent: items.data, coming: bills.coming_up, pending: mine, unread: inbox.unread });
      setHome(h.data);
      setRecent(items.data);
      setComing(bills.coming_up);
      setPending(mine);
      setUnread(inbox.unread);
      setError(null);
      updateBalanceWidget(h.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => toast.subscribe((t) => { if (t && !t.action) setTimeout(load, 300); }), [load]);

  async function invite(member?: Member) {
    if (!home) return;
    try {
      const res = await api<{ data: { url: string; message: string } }>(`/v1/households/${home.id}/invites`, { body: member ? { member_id: member.id } : {} });
      await shareLink(res.data.message, res.data.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't make an invite link.");
    }
  }


  if (!home && !id) {
    // In a group but not a home: offer to set one up.
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground, padding: 24, justifyContent: 'center', gap: 14 }}>
        <T v="display" accessibilityRole="header">No home yet</T>
        <T v="muted">Live with people? Set up your home to split rent, bills and groceries every month.</T>
        <Button title="Set up your home" onPress={() => router.push('/setup' as Href)} />
      </SafeAreaView>
    );
  }
  if (!home) {
    if (!error) return <FullScreenLoader label="Loading your home" />;
    return <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }}><T style={{ padding: 20 }}>{error}</T></SafeAreaView>;
  }

  const byId = new Map(home.members.map((m, i) => [m.id, { ...m, index: i }]));
  const waiting = home.members.filter((m) => m.placeholder && !m.former);
  const others = home.members.filter((m) => !m.you && !m.former);
  const net = home.balance.net_cents;
  const couple = others.length === 1;
  const partner = others[0];
  const headline = net === 0 ? "You're all square"
    : couple && partner ? (net > 0 ? `${partner.first_name} owes you` : `You owe ${partner.first_name}`)
      : net > 0 ? "You're owed" : 'You owe';

  const pendingBanner = <ConfirmPayments payments={pending} nameOf={(mid) => byId.get(mid)?.first_name ?? 'Someone'} oneOnOne={couple} onDone={() => { load(); }} />;

  const balanceCard = (
    <Card dark fireflies style={{ alignItems: 'center', gap: 8, paddingTop: 24, paddingBottom: 20 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${headline} ${formatCents(Math.abs(net))}. See the details.`}
        disabled={!couple || !partner} onPress={() => partner && router.push(`/settle/${partner.id}` as Href)} style={{ alignItems: 'center', gap: 8 }}>
        {couple && partner ? <Avatar name={partner.first_name} index={byId.get(partner.id)?.index ?? 1} /> : null}
        <T v="strong" style={{ color: HT.color.darkCardMuted, fontSize: 14 }}>{headline}</T>
        <Money cents={Math.abs(net)} size={wide ? 56 : 48} color={net > 0 ? HT.color.onDarkOwed : net < 0 ? HT.color.onDarkOwe : HT.color.onDarkText} />
        <T v="small" style={{ color: HT.color.darkCardMuted, textAlign: 'center' }}>
          {net === 0 ? 'Nothing owed either way. Log the next expense and Gloslate does the math.' : 'Everything netted out, already subtracted both ways'}
        </T>
      </Pressable>
      {couple && partner && net > 0 ? (
        <Button kind="onDark" title={`Request ${formatCents(net)}`} icon={<SendIcon size={18} />} style={{ marginTop: 8, alignSelf: 'stretch' }}
          onPress={() => sendRequest(home.id, partner.id).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't send the request."))} />
      ) : null}
      {couple && partner && net < 0 ? (
        <Button kind="onDark" title={`Pay ${partner.first_name} ${formatCents(-net)}`} style={{ marginTop: 8, alignSelf: 'stretch' }}
          onPress={() => router.push(`/settle/${partner.id}` as Href)} />
      ) : null}
      {!couple && home.balance.with.length > 0 ? (
        <View style={{ alignSelf: 'stretch', marginTop: 10, borderTopWidth: 1, borderTopColor: HT.color.onDarkButton, paddingTop: 4 }}>
          {home.balance.with.map((w) => {
            const m = byId.get(w.member_id);
            if (!m) return null;
            return (
              <Pressable key={w.member_id} accessibilityRole="button" onPress={() => router.push(`/settle/${m.id}` as Href)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, opacity: pressed ? 0.7 : 1 })}>
                <Avatar name={m.first_name} index={m.index} size={32} />
                <T v="strong" style={{ color: HT.color.onDarkText, flex: 1 }}>{w.cents > 0 ? `${m.first_name} owes you` : `You owe ${m.first_name}`}</T>
                <Money cents={Math.abs(w.cents)} color={w.cents > 0 ? HT.color.onDarkOwed : HT.color.onDarkOwe} />
                <ChevronIcon size={16} color={HT.color.darkCardMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );

  const comingUp = coming.length > 0 ? (
    <View style={{ gap: 8 }}>
      <T v="heading">Coming up</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {coming.slice(0, 6).map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/bill-cycle/${c.id}` as Href)}
            style={({ pressed }) => ({ backgroundColor: c.missing ? '#FBEBDD' : HT.color.surface, borderRadius: HT.radius.tile, paddingVertical: 10,
              paddingHorizontal: 14, minWidth: 116, opacity: pressed ? 0.75 : 1 })}>
            <T v="strong" style={{ fontSize: 13.5 }}>{c.name}</T>
            <T v="small" style={{ color: c.missing ? HT.color.youOwe : HT.color.muted }}>
              {c.missing ? 'Amount missing' : c.status === 'waiting' ? (c.you_pay ? 'Enter amount' : 'Waiting on amount')
                : `${shortDate(c.due_on)} · ${c.amount_cents ? formatCents(c.amount_cents) : 'varies'}`}
            </T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const invitePanel = waiting.length > 0 ? (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <T v="heading">{waiting.length === 1 ? `Invite ${waiting[0].first_name}` : 'Invite your roommates'}</T>
        <T v="muted">You can log things now. When {waiting.length === 1 ? waiting[0].first_name : 'they'} join{waiting.length === 1 ? 's' : ''}, everything you've added shows up for them.</T>
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

  const recentBlock = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="heading">Recent</T>
        {recent && recent.length > 0 ? <Pressable accessibilityRole="link" onPress={() => router.push('/activity' as Href)} style={{ minHeight: 44, justifyContent: 'center' }}><T v="strong" style={{ color: HT.color.brand, fontSize: 13.5 }}>See all</T></Pressable> : null}
      </View>
      {recent && recent.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>
          {recent.map((e, i) => (
            <ExpenseRow key={e.id} e={e} members={home.members} last={i === recent.length - 1} onPress={() => router.push(`/expense/${e.id}` as Href)} />
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={HT.color.brand} />}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 12, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
              <HouseMark size={34} />
              <View style={{ flexShrink: 1 }}>
                <T v="title" style={{ fontSize: 19, lineHeight: 23 }} accessibilityRole="header" accessibilityLabel="Gloslate by Glofly"><T style={{ color: HT.color.glowDeep }}>glo</T>slate<T v="small" style={{ fontSize: 12, fontFamily: HT.font.medium, color: HT.color.muted }}>  by Glofly</T></T>
                <T v="small" numberOfLines={1}>{names(home.members)}</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <NotificationBell unread={unread} />
              {home.members.filter((m) => !m.former).length < 5 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Invite a roommate" onPress={() => invite()}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: HT.color.chipBorder,
                    backgroundColor: HT.color.surface, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                  <PlusIcon size={14} />
                  <T v="strong" style={{ fontSize: 13 }}>Invite</T>
                </Pressable>
              ) : null}
            </View>
          </View>

          {error ? <T v="small" style={{ color: HT.color.danger }}>{error}</T> : null}
          {pendingBanner}

          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 5, gap: 18 }}>{balanceCard}{comingUp}{invitePanel}</View>
              <View style={{ flex: 6, gap: 18 }}>{recentBlock}</View>
            </View>
          ) : (
            <>
              {balanceCard}
              {comingUp}
              {invitePanel}
              {recentBlock}
            </>
          )}
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 16, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add an expense" onPress={() => router.push('/add' as Href)}
          style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: 36, borderRadius: HT.radius.pill, backgroundColor: HT.color.brand,
            flexDirection: 'row', alignItems: 'center', gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: HT.color.brand, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}>
          <SparkleIcon size={20} />
          <T v="strong" style={{ color: '#FFFFFF', fontSize: 16, fontFamily: HT.font.extrabold }}>Add</T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
