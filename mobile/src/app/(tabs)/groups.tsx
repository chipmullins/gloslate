import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/confirm-payments';
import { GroupIcon } from '@/components/group-icons';
import { AddPersonIcon, CheckIcon, ChevronIcon, SendIcon } from '@/components/icons';
import { Avatar, Button, Card, Money, T } from '@/components/ui';
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
      <View style={{ width: 40, height: 40, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <T v="strong" style={{ fontSize: 13.5, textAlign: 'center' }} numberOfLines={2}>{title}</T>
    </Pressable>
  );
}

/** Everyone outside your home: Balances (who owes, either way), Friends (square, A–Z), then Groups. */
export default function Friends() {
  const { households, refresh } = useSession();
  const { gutter, wide } = useLayout();
  const all = households.filter((h) => h.kind === 'group');
  const people = all.filter((h) => h.member_count === 2);
  const groups = all.filter((h) => h.member_count !== 2);
  const [unread, setUnread] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [netted, setNetted] = useState<PersonNet[]>([]);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ width: '100%', maxWidth: wide ? HT.maxWidth.content : HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="display" accessibilityRole="header">Friends</T>
            <NotificationBell unread={unread} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Action icon={<SendIcon size={18} color={HT.color.brand} />} title="Settle up" sub="One person owes the other" onPress={() => router.push('/request-friend' as Href)} />
            <Action icon={<GroupIcon size={22} color={HT.color.brand} />} title="New group" sub="A trip, dinners, anything shared" onPress={() => router.push('/group/new' as Href)} />
            <Action icon={<AddPersonIcon size={20} color={HT.color.brand} />} title="Add friend" sub="Send each other requests in the app" onPress={inviteFriend} />
          </View>

          {all.length === 0 && friends.length === 0 ? (
            <Card style={{ gap: 8, paddingVertical: 22 }}>
              <T v="heading" style={{ fontSize: 17 }}>Split with anyone, not just roommates</T>
              <T v="muted">
                Covered lunch for a co-worker? Settle up with just them. Going on a trip? Start a group: everyone adds what they paid, even when two people split the hotel, and Gloslate finds the fewest payments to settle everyone.
              </T>
            </Card>
          ) : null}

          {all.length > 0 || friends.length > 0 ? (wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 16 }}>
                <View style={{ gap: 8 }}>
              <SectionHead title="Balances" />
              {balances.length + crossTab.length > 0 ? (
                <Card style={{ paddingVertical: 4 }}>
                  {crossTab.map(personRow)}
                  {balances.length && crossTab.length ? <View style={{ height: 1, backgroundColor: HT.color.hairline }} /> : null}
                  {balances.map((g, i) => renderRow(g, i, balances, true, friendTabs.has(g.id)))}
                </Card>
              ) : (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                  <CheckIcon size={18} color={HT.color.owedToYou} />
                  <T v="muted" style={{ flex: 1 }}>You're all square with everyone. New requests and anything waiting to confirm show up here.</T>
                </Card>
              )}
            </View>
                {groups.length > 0 ? (
              <View style={{ gap: 8 }}>
                <SectionHead title="Groups" />
                <Card style={{ paddingVertical: 4 }}>{groups.map((g, i) => renderRow(g, i, groups, false))}</Card>
              </View>
            ) : null}
              </View>
              <View style={{ flex: 1, gap: 16 }}>
                <View style={{ gap: 8 }}>
              <SectionHead title="Friends" note={squareFriends.length ? String(squareFriends.length) : undefined} />
              {squareFriends.length > 0 ? (
                <Card style={{ paddingVertical: 4 }}>{squareFriends.map(friendRow)}</Card>
              ) : (
                <Card style={{ gap: 10, paddingVertical: 16 }}>
                  <T v="muted">Add friends with your link, then send each other requests in the app instead of texting.</T>
                  <Button title="Add a friend" kind="secondary" icon={<AddPersonIcon size={18} color={HT.color.brand} />} onPress={inviteFriend} />
                </Card>
              )}
              {settledOthers.length > 0 ? (
                <>
                  <T v="small" style={{ marginTop: 6 }}>Settled one-on-ones</T>
                  <Card style={{ paddingVertical: 4 }}>{settledOthers.map((g, i) => renderRow(g, i, settledOthers, true))}</Card>
                </>
              ) : null}
            </View>
              </View>
            </View>
          ) : (
            <>
              <View style={{ gap: 8 }}>
              <SectionHead title="Balances" />
              {balances.length + crossTab.length > 0 ? (
                <Card style={{ paddingVertical: 4 }}>
                  {crossTab.map(personRow)}
                  {balances.length && crossTab.length ? <View style={{ height: 1, backgroundColor: HT.color.hairline }} /> : null}
                  {balances.map((g, i) => renderRow(g, i, balances, true, friendTabs.has(g.id)))}
                </Card>
              ) : (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                  <CheckIcon size={18} color={HT.color.owedToYou} />
                  <T v="muted" style={{ flex: 1 }}>You're all square with everyone. New requests and anything waiting to confirm show up here.</T>
                </Card>
              )}
            </View>
              <View style={{ gap: 8 }}>
              <SectionHead title="Friends" note={squareFriends.length ? String(squareFriends.length) : undefined} />
              {squareFriends.length > 0 ? (
                <Card style={{ paddingVertical: 4 }}>{squareFriends.map(friendRow)}</Card>
              ) : (
                <Card style={{ gap: 10, paddingVertical: 16 }}>
                  <T v="muted">Add friends with your link, then send each other requests in the app instead of texting.</T>
                  <Button title="Add a friend" kind="secondary" icon={<AddPersonIcon size={18} color={HT.color.brand} />} onPress={inviteFriend} />
                </Card>
              )}
              {settledOthers.length > 0 ? (
                <>
                  <T v="small" style={{ marginTop: 6 }}>Settled one-on-ones</T>
                  <Card style={{ paddingVertical: 4 }}>{settledOthers.map((g, i) => renderRow(g, i, settledOthers, true))}</Card>
                </>
              ) : null}
            </View>
              {groups.length > 0 ? (
              <View style={{ gap: 8 }}>
                <SectionHead title="Groups" />
                <Card style={{ paddingVertical: 4 }}>{groups.map((g, i) => renderRow(g, i, groups, false))}</Card>
              </View>
            ) : null}
            </>
          )) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
