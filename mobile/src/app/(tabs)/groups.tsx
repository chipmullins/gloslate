import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/confirm-payments';
import { GroupIcon } from '@/components/group-icons';
import { AddPersonIcon, CheckIcon, ChevronIcon, CloseIcon, PlusIcon, SearchIcon, SendIcon } from '@/components/icons';
import { Avatar, Button, Card, Money, T } from '@/components/ui';
import { WebTopNav } from '@/components/web-top-nav';
import { useTabBarInset } from '@/components/pill-tab-bar';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useLive } from '@/lib/live';
import { api, ApiError, type Friend, type PersonNet, type HouseholdSummary } from '@/lib/api';
import { shareLink } from '@/lib/share';
import { formatCents } from '@/lib/money';
import { toast } from '@/lib/toast';
import { useSession } from '@/lib/session';

/** Words for a balance: "Jordan owes you" / "You owe Jordan" / "Settled". */
function balanceLine(g: HouseholdSummary, oneOnOne: boolean) {
  const net = g.balance.net_cents;
  const name = g.people?.[0] ?? 'them';
  if (net === 0) return { text: 'Settled', color: HT.color.muted };
  if (oneOnOne) return net > 0 ? { text: `${name} owes you`, color: HT.color.owedToYou } : { text: `You owe ${name}`, color: HT.color.youOwe };
  return net > 0 ? { text: "You're owed", color: HT.color.owedToYou } : { text: 'You owe', color: HT.color.youOwe };
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <T v="heading" accessibilityRole="header">{title}</T>
      {note ? <T v="small">{note}</T> : null}
    </View>
  );
}

/** A compact shortcut tile: three sit in one row at every size, so Balances stays near the top. */
function Action({ icon, title, sub, onPress }: { icon: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 88, paddingVertical: 12, paddingHorizontal: 6,
        borderRadius: HT.radius.card, backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: HT.radius.tile, backgroundColor: HT.color.ground, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <T v="strong" style={{ fontSize: 13.5, textAlign: 'center' }} numberOfLines={2}>{title}</T>
    </Pressable>
  );
}

/** Everyone outside your home: Balances (who owes, either way), Friends (square, A–Z), then Groups. */
export default function Friends() {
  const { households, refresh } = useSession();
  const { gutter, wide, desktop } = useLayout();
  const tabInset = useTabBarInset();
  const all = households.filter((h) => h.kind === 'group');
  const people = all.filter((h) => h.member_count === 2);
  const groups = all.filter((h) => h.member_count !== 2);
  const [unread, setUnread] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [netted, setNetted] = useState<PersonNet[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'owed' | 'owe' | 'groups' | 'square'>('all');
  const loadFriends = useCallback(() => {
    api<{ data: Friend[]; link: string }>('/v1/friends').then((r) => { setFriends(r.data); setLink(r.link); }).catch(() => {});
    api<{ data: PersonNet[] }>('/v1/people').then((r) => setNetted(r.data)).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => {
    refresh().catch(() => {});
    loadFriends();
    api<{ unread: number }>('/v1/notifications').then((r) => setUnread(r.unread)).catch(() => {});
  }, [refresh, loadFriends]));
  useLive(({ unread: n }) => { setUnread(n); refresh().catch(() => {}); loadFriends(); });

  const friendTabs = new Set(friends.map((f) => f.tab_id).filter(Boolean) as string[]);
  const tabIds = new Set(people.map((p) => p.id));
  const owing = (g: HouseholdSummary) => g.balance.net_cents !== 0 || (g.to_confirm_cents ?? 0) > 0;
  // People you share more than one tab with get one netted row (their one-on-one folds into it,
  // unless a payment there is waiting for you to confirm).
  const crossTab = netted.filter((p) => p.tab_count > 1 && p.net_cents !== 0);
  const foldedTabs = new Set(crossTab.flatMap((p) => p.tabs.map((t) => t.household_id)));
  // Balances: one-on-ones where money is owed either way or a payment waits for you; waiting first, then biggest.
  const balances = people.filter((g) => owing(g) && (!foldedTabs.has(g.id) || (g.to_confirm_cents ?? 0) > 0)).sort((a, b) =>
    Number(!!b.to_confirm_cents) - Number(!!a.to_confirm_cents) || Math.abs(b.balance.net_cents) - Math.abs(a.balance.net_cents));
  const owingTabs = new Set(balances.map((g) => g.id));
  // Friends: everyone you're friends with and square with (settled tab, hidden tab or no tab yet), A–Z.
  const crossTabUsers = new Set(crossTab.map((p) => p.user_id));
  const squareFriends = friends.filter((f) => (!f.tab_id || !owingTabs.has(f.tab_id)) && !crossTabUsers.has(f.user_id))
    .sort((a, b) => a.first_name.localeCompare(b.first_name));
  // Settled one-on-ones with people who aren't friends: kept below friends, and still swipe away.
  const settledOthers = people.filter((g) => !owing(g) && !friendTabs.has(g.id));

  async function inviteFriend() {
    const url = link ?? (await api<{ link: string }>('/v1/friends').then((r) => r.link).catch(() => null));
    if (!url) return toast.show({ text: "Couldn't make your link. Try again." });
    await shareLink(`Add me on Gloslate so we can send each other what we owe without texting: ${url}`, url).catch(() => {});
  }

  async function openFriend(f: Friend) {
    try {
      const r = await api<{ data: { household_id: string } }>(`/v1/friends/${f.user_id}/tab`, { body: {} });
      await refresh();
      router.push(`/group/${r.data.household_id}` as Href);
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't open it." });
    }
  }

  const personRow = (p: PersonNet, i: number) => {
    const theyOwe = p.net_cents > 0;
    const color = theyOwe ? HT.color.owedToYou : HT.color.youOwe;
    const line = `${theyOwe ? 'Owes you' : 'You owe'} · across ${p.tab_count} tabs`;
    return (
      <Pressable key={p.user_id} accessibilityRole="button" accessibilityLabel={`${p.first_name}. ${line}, ${formatCents(Math.abs(p.net_cents))}`}
        onPress={() => router.push(`/people/${p.user_id}` as Href)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1,
          borderTopWidth: i > 0 ? 1 : 0, borderTopColor: HT.color.hairline })}>
        <Avatar name={p.first_name} index={(i % 4) + 1} size={44} photo={p.photo_url} />
        <View style={{ flex: 1 }}>
          <T v="strong" numberOfLines={1}>{p.first_name}</T>
          <T v="small" numberOfLines={1}>{line}</T>
        </View>
        <Money cents={Math.abs(p.net_cents)} size={16} color={color} />
        <ChevronIcon size={18} color={HT.color.muted} />
      </Pressable>
    );
  };

  const renderRow = (g: HouseholdSummary, i: number, list: HouseholdSummary[], oneOnOne: boolean, friend = false) => {
    const line = balanceLine(g, oneOnOne);
    const title = oneOnOne ? g.people?.[0] ?? g.name : g.name;
    const sub = oneOnOne ? (friend ? 'Friend' : 'One-on-one') : `${g.member_count} people${g.people?.length ? ` · ${g.people.slice(0, 3).join(', ')}${g.member_count > 4 ? '…' : ''}` : ''}`;
    const row = (
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${line.text}${g.balance.net_cents ? ` ${formatCents(Math.abs(g.balance.net_cents))}` : ''}${g.to_confirm_cents ? `. ${formatCents(g.to_confirm_cents)} marked paid, waiting for you to confirm` : ''}`}
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
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {g.to_confirm_cents ? (
            <View style={{ backgroundColor: HT.color.brand, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <T v="small" style={{ color: HT.color.onBrand, fontFamily: HT.font.bold, fontSize: 12 }}>Confirm {formatCents(g.to_confirm_cents)}</T>
            </View>
          ) : null}
          <T v="small" style={{ color: line.color }}>{line.text}</T>
          {g.balance.net_cents !== 0 ? <Money cents={Math.abs(g.balance.net_cents)} size={16} color={line.color} /> : null}
        </View>
        <ChevronIcon size={18} color={HT.color.muted} />
      </Pressable>
    );
    // Settled tabs can be swiped off the list (they come back when anything new happens).
    if (g.balance.net_cents !== 0 || g.to_confirm_cents) return <View key={g.id}>{row}</View>;
    return (
      <ReanimatedSwipeable key={g.id} friction={2} rightThreshold={40} overshootRight={false}
        renderRightActions={() => (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${title} from your list`} onPress={() => hide(g, title)}
            style={{ width: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: HT.color.brand, borderRadius: HT.radius.tile, marginVertical: 6, marginLeft: 8 }}>
            <T v="strong" style={{ color: HT.color.onBrand, fontSize: 13 }}>Clear</T>
          </Pressable>
        )}>
        <View style={{ backgroundColor: HT.color.surface }}>{row}</View>
      </ReanimatedSwipeable>
    );
  };

  const friendRow = (f: Friend, i: number) => {
    const visibleTab = f.tab_id && tabIds.has(f.tab_id) ? f.tab_id : null;
    const name = `${f.first_name}${f.last_initial ? ` ${f.last_initial}.` : ''}`;
    const sub = f.tab_id ? 'Friend · all square' : 'Friend · no tab yet';
    return (
      <Pressable key={f.user_id} accessibilityRole="button" accessibilityLabel={`${name}. ${sub}.${f.tab_id ? ' Open your tab.' : ' Start a tab.'}`}
        onPress={() => (visibleTab ? router.push(`/group/${visibleTab}` as Href) : openFriend(f))}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1,
          borderTopWidth: i > 0 ? 1 : 0, borderTopColor: HT.color.hairline })}>
        <Avatar photo={f.photo_url} name={f.first_name} index={(i % 4) + 1} size={40} />
        <View style={{ flex: 1 }}>
          <T v="strong" numberOfLines={1}>{name}</T>
          <T v="small" numberOfLines={1}>{sub}</T>
        </View>
        {f.tab_id ? null : <T v="strong" style={{ color: HT.color.brand, fontSize: 13 }}>Start a tab</T>}
        <ChevronIcon size={18} color={HT.color.muted} />
      </Pressable>
    );
  };

  async function hide(g: HouseholdSummary, title: string) {
    try {
      await api(`/v1/households/${g.id}/hide`, { body: {} });
      await refresh();
      toast.show({ text: `Cleared ${title}. It comes back if anything new is added.`, ms: 5000,
        action: { label: 'Undo', run: () => { api(`/v1/households/${g.id}/hide`, { method: 'DELETE' }).then(() => refresh()).catch(() => {}); } } });
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't clear it." });
    }
  }

  // Search and chips (pill bar redesign): narrow every list below by name and by which way money goes.
  const match = (name: string | undefined) => !q.trim() || (name ?? '').toLowerCase().includes(q.trim().toLowerCase());
  const way = (net: number, waiting = 0) => filter === 'all' || (filter === 'owed' && (net > 0 || waiting > 0)) || (filter === 'owe' && net < 0);
  const showPeople = filter === 'all' || filter === 'owed' || filter === 'owe';
  // The biggest balance gets the night card at the top (the person across tabs first); it leaves the list below.
  const lead = !q.trim() && filter === 'all'
    ? crossTab.slice().sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents))[0] ?? null : null;
  const leadTab = !q.trim() && filter === 'all' && !lead ? balances.find((g) => g.balance.net_cents !== 0 && !g.to_confirm_cents) ?? null : null;
  const crossShown = showPeople ? crossTab.filter((p) => p !== lead && match(p.first_name) && way(p.net_cents)) : [];
  const balancesShown = showPeople ? balances.filter((g) => g !== leadTab && match(g.people?.[0] ?? g.name) && way(g.balance.net_cents, g.to_confirm_cents ?? 0)) : [];
  const squareShown = filter === 'all' || filter === 'square' ? squareFriends.filter((f) => match(f.first_name)) : [];
  const settledShown = filter === 'all' || filter === 'square' ? settledOthers.filter((g) => match(g.people?.[0] ?? g.name)) : [];
  const groupsShown = filter === 'all' || filter === 'groups' ? groups.filter((g) => match(g.name) || (g.people ?? []).some(match))
    : filter === 'owed' || filter === 'owe' ? groups.filter((g) => match(g.name) && way(g.balance.net_cents, g.to_confirm_cents ?? 0)) : [];
  const filtering = !!q.trim() || filter !== 'all';
  const nothing = filtering && !lead && !leadTab && crossShown.length + balancesShown.length + squareShown.length + settledShown.length + groupsShown.length === 0;

  const chip = (key: typeof filter, label: string) => {
    const on = filter === key;
    return (
      <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(key)}
        style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', borderWidth: 1,
          backgroundColor: on ? HT.color.ink : HT.color.surface, borderColor: on ? HT.color.ink : HT.color.chipBorder, opacity: pressed ? 0.8 : 1 })}>
        <T style={{ fontFamily: on ? HT.font.bold : HT.font.semibold, fontSize: 14, color: on ? HT.color.ground : HT.color.ink }}>{label}</T>
      </Pressable>
    );
  };

  const leadCard = lead || leadTab ? (() => {
    const net = lead ? lead.net_cents : leadTab!.balance.net_cents;
    const name = lead ? lead.first_name : leadTab!.people?.[0] ?? leadTab!.name;
    const label = lead ? `Across ${lead.tab_count} tabs` : friendTabs.has(leadTab!.id) ? 'Friend' : 'One-on-one';
    const words = net > 0 ? `${name} owes you` : `You owe ${name}`;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${words} ${formatCents(Math.abs(net))}, ${label}`}
        onPress={() => router.push((lead ? `/people/${lead.user_id}` : `/group/${leadTab!.id}`) as Href)}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
        <Card dark fireflies style={{ gap: 4, paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <T style={{ fontFamily: HT.font.label, fontSize: 11.5, letterSpacing: 1.8, color: HT.color.glow, textTransform: 'uppercase' }}>{label}</T>
            <ChevronIcon size={18} color={HT.color.darkCardMuted} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Avatar name={name} index={1} size={44} photo={lead?.photo_url} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: HT.font.displayExtra, fontSize: 20, color: HT.color.onDarkText }} numberOfLines={1}>{words}</T>
              <Money cents={Math.abs(net)} size={32} color={net > 0 ? HT.color.onDarkOwed : HT.color.onDarkOwe} />
            </View>
          </View>
        </Card>
      </Pressable>
    );
  })() : null;

  const balancesBlock = showPeople && (crossShown.length + balancesShown.length > 0 || !filtering) ? (
    <View style={{ gap: 8 }}>
      <SectionHead title="Balances" />
      {crossShown.length + balancesShown.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>
          {crossShown.map(personRow)}
          {balancesShown.length && crossShown.length ? <View style={{ height: 1, backgroundColor: HT.color.hairline }} /> : null}
          {balancesShown.map((g, i) => renderRow(g, i, balancesShown, true, friendTabs.has(g.id)))}
        </Card>
      ) : lead || leadTab ? null : (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 }}>
          <CheckIcon size={18} color={HT.color.owedToYou} />
          <T v="muted" style={{ flex: 1 }}>You're all square with everyone. New requests and anything waiting to confirm show up here.</T>
        </Card>
      )}
    </View>
  ) : null;

  const friendsBlock = (filter === 'all' || filter === 'square') && (squareShown.length + settledShown.length > 0 || !filtering) ? (
    <View style={{ gap: 8 }}>
      <SectionHead title="Friends" note={squareShown.length ? String(squareShown.length) : undefined} />
      {squareShown.length > 0 ? (
        <Card style={{ paddingVertical: 4 }}>{squareShown.map(friendRow)}</Card>
      ) : squareFriends.length === 0 ? (
        <Card style={{ gap: 10, paddingVertical: 16 }}>
          <T v="muted">Add friends with your link, then send each other requests in the app instead of texting.</T>
          <Button title="Add a friend" kind="secondary" icon={<AddPersonIcon size={18} color={HT.color.brand} />} onPress={inviteFriend} />
        </Card>
      ) : null}
      {settledShown.length > 0 ? (
        <>
          <T v="small" style={{ marginTop: 6 }}>Settled one-on-ones</T>
          <Card style={{ paddingVertical: 4 }}>{settledShown.map((g, i) => renderRow(g, i, settledShown, true))}</Card>
        </>
      ) : null}
    </View>
  ) : null;

  const groupsBlock = groupsShown.length > 0 ? (
    <View style={{ gap: 8 }}>
      <SectionHead title="Groups" />
      <Card style={{ paddingVertical: 4 }}>{groupsShown.map((g, i) => renderRow(g, i, groupsShown, false))}</Card>
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      {desktop ? <WebTopNav /> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: tabInset }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ width: '100%', maxWidth: wide ? HT.maxWidth.content : HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="hero" accessibilityRole="header">Friends</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {desktop ? null : <NotificationBell unread={unread} />}
              <Pressable accessibilityRole="button" accessibilityLabel="Add a friend" onPress={inviteFriend}
                style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: HT.color.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
                <PlusIcon size={18} color={HT.color.ground} />
              </Pressable>
            </View>
          </View>

          {all.length > 0 || friends.length > 0 ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 16,
                backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline }}>
                <SearchIcon size={18} color={HT.color.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Who are you settling with?" placeholderTextColor={HT.color.faint}
                  accessibilityLabel="Search friends and groups" autoCorrect={false} returnKeyType="search" maxFontSizeMultiplier={1.4}
                  style={{ flex: 1, minHeight: 48, fontFamily: HT.font.medium, fontSize: 15.5, color: HT.color.ink, outlineStyle: 'none' } as object} />
                {q ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={10}>
                    <CloseIcon size={16} color={HT.color.muted} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -gutter }}
                contentInset={{ left: gutter, right: gutter }} contentOffset={{ x: -gutter, y: 0 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: Platform.OS === 'ios' ? 0 : gutter }}>
                  {chip('all', 'All')}{chip('owed', 'Owes you')}{chip('owe', 'You owe')}{chip('groups', 'Groups')}{chip('square', 'Square')}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {leadCard}

          {filtering ? null : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Action icon={<SendIcon size={18} color={HT.color.ink} />} title="Settle up" sub="One person owes the other" onPress={() => router.push('/request-friend' as Href)} />
              <Action icon={<GroupIcon size={22} color={HT.color.ink} />} title="New group" sub="A trip, dinners, anything shared" onPress={() => router.push('/group/new' as Href)} />
              <Action icon={<AddPersonIcon size={20} color={HT.color.ink} />} title="Add friend" sub="Send each other requests in the app" onPress={inviteFriend} />
            </View>
          )}

          {all.length === 0 && friends.length === 0 ? (
            <Card style={{ gap: 8, paddingVertical: 22 }}>
              <T v="heading" style={{ fontSize: 17 }}>Split with anyone, not just roommates</T>
              <T v="muted">
                Covered lunch for a co-worker? Settle up with just them. Going on a trip? Start a group: everyone adds what they paid, even when two people split the hotel, and Gloslate finds the fewest payments to settle everyone.
              </T>
            </Card>
          ) : null}

          {nothing ? <T v="muted" style={{ textAlign: 'center', paddingVertical: 20 }}>No one matches that.</T> : null}

          {all.length > 0 || friends.length > 0 ? (wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 16 }}>{balancesBlock}{groupsBlock}</View>
              <View style={{ flex: 1, gap: 16 }}>{friendsBlock}</View>
            </View>
          ) : (
            <>
              {balancesBlock}
              {friendsBlock}
              {groupsBlock}
            </>
          )) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
