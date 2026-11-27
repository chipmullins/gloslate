import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';

import { ConfirmPayments, LatestNotice, NotificationBell } from '@/components/confirm-payments';
import { ExpenseRow, shortDate } from '@/components/expense-row';
import { DESKTOP_MAX, WebTopNav } from '@/components/web-top-nav';
import { CameraIcon, ChevronIcon, HouseIcon, HouseMark, PlusIcon, SendIcon, ShareIcon } from '@/components/icons';
import { useTabBarInset } from '@/components/pill-tab-bar';
import { FullScreenLoader } from '@/components/bunny-loader';
import { FriendsSummaryCard, SetUpHomeCard } from '@/components/no-home';
import { OutboxBanner } from '@/components/outbox-banner';
import { RecapBanner } from '@/components/recap-banner';
import { Avatar, Button, Card, Money, NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useLive } from '@/lib/live';
import { api, ApiError, categoryLabel, type BillCycle, type Expense, type Household, type Member, type NotificationItem, type Payment } from '@/lib/api';
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

/** Sends a request in `tone` (Gentle · Plain · Cheeky); without one, the server uses your saved Reminders tone. */
export async function sendRequest(householdId: string, memberId: string, name?: string, tone?: string) {
  const res = await api<{ data: { url: string; message: string; in_app?: boolean; amount_cents: number } }>(`/v1/households/${householdId}/requests`, { body: { member_id: memberId, ...(tone ? { tone } : {}) } });
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
  const { wide, gutter, desktop } = useLayout();
  const tabInset = useTabBarInset();
  const { top } = useSafeAreaInsets();
  const [month, setMonth] = useState<{ count: number; total_cents: number; my_share_cents: number } | null>(null);
  const [paidBy, setPaidBy] = useState<'all' | 'me' | 'them'>('all');
  // Start from what we showed last time (instant when switching tabs or reopening), then refresh.
  const [snap] = useState(() => homeCache.get(households.find((h) => h.kind !== 'group')?.id ?? '') ?? EMPTY);
  const [home, setHome] = useState<Household | null>(snap.home);
  const [recent, setRecent] = useState<Expense[] | null>(snap.recent);
  const [coming, setComing] = useState<BillCycle[]>(snap.coming);
  const [pending, setPending] = useState<Payment[]>(snap.pending);
  const [unread, setUnread] = useState(snap.unread);
  const [latest, setLatest] = useState<NotificationItem | null>(null);
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
        api<{ data: NotificationItem[]; unread: number }>('/v1/notifications'),
      ]);
      const mine = pays.data.filter((p) => p.can_confirm);
      homeCache.set(id, { home: h.data, recent: items.data, coming: bills.coming_up, pending: mine, unread: inbox.unread });
      setHome(h.data);
      setRecent(items.data);
      setComing(bills.coming_up);
      setPending(mine);
      setUnread(inbox.unread);
      setLatest(inbox.data.find((n) => !n.read) ?? null);
      if (desktop) {
        const ym = new Date().toISOString().slice(0, 7);
        api<{ meta: { totals?: { count: number; total_cents: number; my_share_cents: number } } }>(`/v1/households/${id}/history?month=${ym}`)
          .then((m) => setMonth(m.meta.totals ?? null)).catch(() => {});
      }
      setError(null);
      updateBalanceWidget(h.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [id, desktop]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // The phone Home starts on the night sky: light status bar while it's showing, back to the app's own after.
  const nightTop = !desktop && !!home;
  useFocusEffect(useCallback(() => {
    if (!nightTop) return undefined;
    setStatusBarStyle('light');
    return () => setStatusBarStyle(HT.scheme === 'dark' ? 'light' : 'dark');
  }, [nightTop]));
  // Someone confirms, pays or adds something: show it without pull-to-refresh.
  useLive(({ unread: n }) => { setUnread(n); load(); });
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
    // Friends-only (or just groups): where you stand with friends, and a way to set up a home later.
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ paddingBottom: tabInset }}>
          <View style={{ width: '100%', maxWidth: HT.maxWidth.form + (wide ? 160 : 0), alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 12, gap: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
              <HouseMark size={34} />
              <T v="title" style={{ fontSize: 19, lineHeight: 23 }} accessibilityRole="header" accessibilityLabel="Gloslate by Glofly"><T style={{ color: HT.color.glowDeep }}>glo</T>slate<T v="small" style={{ fontSize: 12, fontFamily: HT.font.medium, color: HT.color.muted }}>  by Glofly</T></T>
            </View>
            <FriendsSummaryCard />
            <SetUpHomeCard />
          </View>
        </ScrollView>
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

  const outboxBanner = home ? <OutboxBanner householdId={home.id} /> : null;
  const pendingBanner = <ConfirmPayments payments={pending} nameOf={(mid) => byId.get(mid)?.first_name ?? 'Someone'} oneOnOne={couple} onDone={() => { load(); }} />;

  const comingUp = coming.length > 0 ? (
    <View style={{ gap: 8 }}>
      <T v="heading">Coming up</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {coming.slice(0, 6).map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/bill-cycle/${c.id}` as Href)}
            style={({ pressed }) => ({ backgroundColor: c.missing ? HT.color.warnTint : HT.color.surface, borderRadius: HT.radius.tile, paddingVertical: 10,
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
          <Avatar photo={m.photo_url} name={m.first_name} index={byId.get(m.id)?.index ?? 1} size={34} />
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

  if (desktop) {
    // The website on a computer (canvas "Web app redesign", B): the nav and balance share the
    // night sky (fireflies included), cards overlap its edge, then Recent as a table.
    const meName = home.me?.id;
    const rows = (recent ?? []).filter((e) => paidBy === 'all' || (paidBy === 'me' ? e.payer_id === meName : e.payer_id !== meName));
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    const card = (title: string, body: React.ReactNode) => (
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, backgroundColor: HT.color.surface, borderRadius: HT.radius.card, paddingVertical: 22, paddingHorizontal: 24, gap: 12,
        shadowColor: '#140C18', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } }}>
        <T v="label" accessibilityRole="header" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: HT.font.bold }}>{title}</T>
        {body}
      </View>
    );
    const chip = (key: 'all' | 'me' | 'them', label: string) => (
      <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: paidBy === key }} onPress={() => setPaidBy(key)}
        style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: paidBy === key ? HT.color.brandTint : HT.color.surface,
          borderWidth: paidBy === key ? 0 : 1, borderColor: HT.color.hairline }}>
        <T style={{ fontFamily: paidBy === key ? HT.font.bold : HT.font.semibold, fontSize: 14, color: paidBy === key ? HT.color.brand : HT.color.ink }}>{label}</T>
      </Pressable>
    );
    const col = { paddingVertical: 14, paddingHorizontal: 8 };
    return (
      <View style={{ flex: 1, backgroundColor: HT.color.ground }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 56 }}>
          <NightSurface fireflies style={{ paddingBottom: 124 }}>
            <WebTopNav bare unread={unread} />
            <View style={{ width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 32 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${headline} ${formatCents(Math.abs(net))}. See the details.`}
                disabled={!couple || !partner} onPress={() => partner && router.push(`/settle/${partner.id}` as Href)} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 420, gap: 6 }}>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, backgroundColor: HT.color.onDarkButton }}>
                  {couple && partner ? <Avatar photo={partner.photo_url} name={partner.first_name} index={byId.get(partner.id)?.index ?? 1} size={26} /> : <HouseMark size={26} inverted />}
                  <T style={{ fontFamily: HT.font.semibold, fontSize: 14, color: HT.color.darkCardMuted }}>{home.name || 'Home'} · {names(home.members)}</T>
                </View>
                <T style={{ fontFamily: HT.font.display, fontSize: 22, color: HT.color.darkCardMuted, marginTop: 12 }}>{headline}</T>
                <Money cents={Math.abs(net)} size={84} color={net > 0 ? HT.color.onDarkOwed : net < 0 ? HT.color.onDarkOwe : HT.color.onDarkText} />
                <T style={{ fontFamily: HT.font.medium, fontSize: 15, color: HT.color.darkCardMuted }}>
                  {net === 0 ? 'Nothing owed either way. Log the next expense and Gloslate does the math.' : 'Everything netted out, both ways.'}
                </T>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {couple && partner && net > 0 ? (
                  <Button kind="onDark" title={`Request ${formatCents(net)}`} icon={<SendIcon size={18} />} style={{ paddingHorizontal: 26 }}
                    onPress={() => sendRequest(home.id, partner.id).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't send the request."))} />
                ) : null}
                {couple && partner && net > 0 ? (
                  <Button kind="glass" title={`${partner.first_name} paid me`} style={{ paddingHorizontal: 22 }} onPress={() => router.push(`/settle/${partner.id}` as Href)} />
                ) : null}
                {couple && partner && net < 0 ? (
                  <Button kind="onDark" title={`Pay ${partner.first_name} ${formatCents(-net)}`} style={{ paddingHorizontal: 26 }} onPress={() => router.push(`/settle/${partner.id}` as Href)} />
                ) : null}
              </View>
            </View>
            {!couple && home.balance.with.length > 0 ? (
              <View style={{ width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 18, flexDirection: 'row', flexWrap: 'wrap', columnGap: 28 }}>
                {home.balance.with.map((w) => {
                  const m = byId.get(w.member_id);
                  if (!m) return null;
                  return (
                    <Pressable key={w.member_id} accessibilityRole="button" onPress={() => router.push(`/settle/${m.id}` as Href)}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, opacity: pressed ? 0.7 : 1 })}>
                      <Avatar photo={m.photo_url} name={m.first_name} index={m.index} size={30} />
                      <T v="strong" style={{ color: HT.color.onDarkText }}>{w.cents > 0 ? `${m.first_name} owes you` : `You owe ${m.first_name}`}</T>
                      <Money cents={Math.abs(w.cents)} color={w.cents > 0 ? HT.color.onDarkOwed : HT.color.onDarkOwe} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </NightSurface>

          <View style={{ width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center', paddingHorizontal: 32, marginTop: -88, gap: 24 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              {card('Coming up', coming.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {coming.slice(0, 2).map((c) => (
                    <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/bill-cycle/${c.id}` as Href)} style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                        <T style={{ fontFamily: HT.font.displayBold, fontSize: 20 }}>{c.name}</T>
                        {c.amount_cents ? <Money cents={c.amount_cents} size={20} /> : null}
                      </View>
                      <T v="small" style={{ color: c.missing ? HT.color.youOwe : HT.color.muted, fontSize: 14 }}>
                        {c.missing ? 'Amount missing' : c.status === 'waiting' ? (c.you_pay ? 'Enter the amount' : 'Waiting on the amount') : `Posts ${shortDate(c.due_on)}`}
                      </T>
                    </Pressable>
                  ))}
                </View>
              ) : <T v="muted">No bills set up yet.</T>)}
              {card(`${monthName} so far`, month ? (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <T style={{ fontFamily: HT.font.displayBold, fontSize: 20 }}>{month.count} {month.count === 1 ? 'expense' : 'expenses'}</T>
                    <Money cents={month.total_cents} size={20} />
                  </View>
                  <T v="small" style={{ fontSize: 14 }}>Your share {formatCents(month.my_share_cents)}</T>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: HT.color.segment }}>
                    <View style={{ width: `${month.total_cents ? Math.round((month.my_share_cents / month.total_cents) * 100) : 0}%`, backgroundColor: HT.color.brand }} />
                  </View>
                </View>
              ) : <T v="muted">Nothing logged this month yet.</T>)}
              {card('Quick add', (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Groceries', 'Dinner', 'Takeout', 'Household supplies'].map((p) => (
                    <Pressable key={p} accessibilityRole="button" accessibilityLabel={`Add ${p}`} onPress={() => router.push(`/add?pick=${encodeURIComponent(p)}` as Href)}
                      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: HT.color.chipBorder,
                        backgroundColor: HT.color.surface, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                      <T style={{ fontFamily: HT.font.semibold, fontSize: 14 }}>{p}</T>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel="Scan a receipt" onPress={() => router.push('/add' as Href)}
                    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: HT.color.chipBorder,
                      flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                    <CameraIcon size={16} color={HT.color.brand} />
                    <T style={{ fontFamily: HT.font.bold, fontSize: 14, color: HT.color.brand }}>Scan a receipt</T>
                  </Pressable>
                </View>
              ))}
            </View>

            {error ? <T v="small" style={{ color: HT.color.danger }}>{error}</T> : null}
            <LatestNotice item={latest} />
            <RecapBanner />
            {outboxBanner}
            {pendingBanner}
            {invitePanel}

            <Card style={{ paddingVertical: 24, paddingHorizontal: 28, gap: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <T v="title" accessibilityRole="header" style={{ fontSize: 22 }}>Recent activity</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {chip('all', 'All')}
                  {chip('me', 'You paid')}
                  {chip('them', couple && partner ? `${partner.first_name} paid` : 'Others paid')}
                </View>
              </View>
              {rows.length > 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HT.color.hairline }}>
                    <T v="small" style={{ ...col, width: 90, fontFamily: HT.font.semibold }}>Date</T>
                    <T v="small" style={{ ...col, flex: 1, fontFamily: HT.font.semibold }}>What</T>
                    <T v="small" style={{ ...col, width: 180, fontFamily: HT.font.semibold }}>Paid by</T>
                    <T v="small" style={{ ...col, width: 220, textAlign: 'right', fontFamily: HT.font.semibold }}>Effect on your balance</T>
                  </View>
                  {rows.map((e) => {
                    const payer = byId.get(e.payer_id);
                    const fx = e.effect_for_me_cents;
                    const color = fx > 0 ? HT.color.owedToYou : fx < 0 ? HT.color.youOwe : HT.color.muted;
                    return (
                      <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push(`/expense/${e.id}` as Href)}
                        accessibilityLabel={`${e.description || categoryLabel(e.category)}, ${shortDate(e.spent_on)}, paid by ${payer?.you ? 'you' : payer?.first_name ?? 'a former member'}`}
                        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: HT.color.hairline,
                          backgroundColor: hovered ? HT.color.ground : 'transparent', opacity: pressed ? 0.7 : 1 })}>
                        <T v="muted" style={{ ...col, width: 90, fontSize: 15 }}>{shortDate(e.spent_on)}</T>
                        <T v="strong" numberOfLines={1} style={{ ...col, flex: 1, fontSize: 15 }}>{e.description || categoryLabel(e.category)}</T>
                        <View style={{ ...col, width: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {payer ? <Avatar photo={payer.photo_url} name={payer.first_name} index={payer.index} size={26} /> : null}
                          <T style={{ fontSize: 15 }}>{payer?.you ? 'You' : payer?.first_name ?? 'Former member'}</T>
                        </View>
                        <View style={{ ...col, width: 220, alignItems: 'flex-end' }}>
                          {fx === 0 ? <T v="small">even</T> : <Money cents={fx} sign color={color} size={15.5} style={{ fontFamily: HT.font.monoBold }} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <T v="muted" style={{ paddingVertical: 16 }}>{recent && recent.length ? 'Nothing here with that filter.' : "Nothing logged yet. Add the rent, tonight's dinner, or the last grocery run."}</T>
              )}
              <Pressable accessibilityRole="link" onPress={() => router.push('/activity' as Href)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <T v="strong" style={{ color: HT.color.brand, fontSize: 14 }}>See all activity</T>
              </Pressable>
            </Card>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Phones and tablets (canvas "Gloslate · Pill bar redesign"): the balance on the night sky (fireflies kept),
  // a rounded sheet over its edge with square actions and the violet main action, then the rest of Home.
  const members = home.members.filter((m) => !m.former).length;
  const square = (label: string, icon: React.ReactNode, onPress: () => void, a11y?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 74, borderRadius: 18, borderWidth: 1, borderColor: HT.color.hairline, backgroundColor: HT.color.surface,
        alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      {icon}
      <T numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: HT.font.semibold, fontSize: 12.5 }}>{label}</T>
    </Pressable>
  );
  const squares = [
    square('Add', <PlusIcon size={20} color={HT.color.ink} />, () => router.push('/add' as Href), 'Add an expense'),
    square('Scan', <CameraIcon size={20} color={HT.color.ink} />, () => router.push('/add' as Href), 'Scan a receipt'),
    couple && partner ? square('Settle up', <SendIcon size={20} color={HT.color.ink} />, () => router.push(`/settle/${partner.id}` as Href), `Settle up with ${partner.first_name}`) : null,
    members < 5 ? square('Invite', <ShareIcon size={20} color={HT.color.ink} />, () => invite(), 'Invite a roommate') : null,
  ].filter(Boolean);
  const mainAction = couple && partner && net > 0 ? (
    <Button kind="accent" title={`Request ${formatCents(net)} from ${partner.first_name}`} icon={<SendIcon size={18} color={HT.color.onAccent} />} style={{ minHeight: 58, borderRadius: 18 }}
      onPress={() => sendRequest(home.id, partner.id).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't send the request."))} />
  ) : couple && partner && net < 0 ? (
    <Button kind="accent" title={`Pay ${partner.first_name} ${formatCents(-net)}`} style={{ minHeight: 58, borderRadius: 18 }}
      onPress={() => router.push(`/settle/${partner.id}` as Href)} />
  ) : null;
  const shell = { width: '100%' as const, maxWidth: HT.maxWidth.content, alignSelf: 'center' as const, paddingHorizontal: gutter };

  return (
    <View style={{ flex: 1, backgroundColor: HT.color.ground }}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabInset }} style={{ backgroundColor: HT.color.ground }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          tintColor={HT.color.onDarkText} colors={[HT.color.brand]} progressViewOffset={top} />}>
        <NightSurface fireflies style={{ paddingTop: top + 10, paddingBottom: 58 }}>
          <View style={[shell, { gap: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                <HouseMark size={34} inverted />
                <T v="title" style={{ fontSize: 19, lineHeight: 23, color: HT.color.onDarkText }} accessibilityRole="header" accessibilityLabel="Gloslate by Glofly">
                  <T style={{ color: HT.color.glow }}>glo</T>slate<T v="small" style={{ fontSize: 12, fontFamily: HT.font.medium, color: HT.color.darkCardMuted }}>  by Glofly</T>
                </T>
              </View>
              <NotificationBell unread={unread} onDark />
            </View>
            <View style={{ alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 12, borderRadius: 999, backgroundColor: HT.color.onDarkButton }}>
              {couple && partner ? <Avatar photo={partner.photo_url} name={partner.first_name} index={byId.get(partner.id)?.index ?? 1} size={24} /> : <HouseIcon size={16} color={HT.color.darkCardMuted} />}
              <T numberOfLines={1} style={{ fontFamily: HT.font.semibold, fontSize: 13, color: HT.color.darkCardMuted, flexShrink: 1 }}>{home.name || 'Home'} · {names(home.members)}</T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${headline} ${formatCents(Math.abs(net))}. See the details.`}
              disabled={!couple || !partner} onPress={() => partner && router.push(`/settle/${partner.id}` as Href)} style={{ gap: 2, marginTop: 18 }}>
              <T style={{ fontFamily: HT.font.label, fontSize: 12, letterSpacing: 2.2, color: HT.color.glow, textTransform: 'uppercase' }}>{headline}</T>
              <Money cents={Math.abs(net)} size={wide ? 76 : 64} color={net > 0 ? HT.color.onDarkOwed : net < 0 ? HT.color.onDarkOwe : HT.color.onDarkText} />
              <T style={{ fontFamily: HT.font.medium, fontSize: 14, color: HT.color.darkCardMuted }}>
                {net === 0 ? 'Nothing owed either way. Log the next expense and Gloslate does the math.' : 'Everything netted out, already subtracted both ways'}
              </T>
            </Pressable>
            {!couple && home.balance.with.length > 0 ? (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: HT.color.onDarkButton, paddingTop: 4 }}>
                {home.balance.with.map((w) => {
                  const m = byId.get(w.member_id);
                  if (!m) return null;
                  return (
                    <Pressable key={w.member_id} accessibilityRole="button" onPress={() => router.push(`/settle/${m.id}` as Href)}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, opacity: pressed ? 0.7 : 1 })}>
                      <Avatar photo={m.photo_url} name={m.first_name} index={m.index} size={32} />
                      <T v="strong" style={{ color: HT.color.onDarkText, flex: 1 }}>{w.cents > 0 ? `${m.first_name} owes you` : `You owe ${m.first_name}`}</T>
                      <Money cents={Math.abs(w.cents)} color={w.cents > 0 ? HT.color.onDarkOwed : HT.color.onDarkOwe} />
                      <ChevronIcon size={16} color={HT.color.darkCardMuted} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </NightSurface>

        <View style={{ marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: HT.color.ground, paddingTop: 22 }}>
          <View style={[shell, { gap: 18 }]}>
            <View style={{ flexDirection: 'row', gap: 10 }}>{squares}</View>
            {mainAction}
            {error ? <T v="small" style={{ color: HT.color.danger }}>{error}</T> : null}
            <LatestNotice item={latest} />
            <RecapBanner />
            {outboxBanner}
            {pendingBanner}
            {wide ? (
              <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
                <View style={{ flex: 5, gap: 18 }}>{comingUp}{invitePanel}</View>
                <View style={{ flex: 6, gap: 18 }}>{recentBlock}</View>
              </View>
            ) : (
              <>
                {comingUp}
                {invitePanel}
                {recentBlock}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
