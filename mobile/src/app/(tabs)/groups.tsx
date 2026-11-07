import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/confirm-payments';
import { GroupIcon } from '@/components/group-icons';
import { AddPersonIcon, ChevronIcon, SendIcon } from '@/components/icons';
import { Avatar, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Friend, type HouseholdSummary } from '@/lib/api';
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
  const [unread, setUnread] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const loadFriends = useCallback(() => {
    api<{ data: Friend[]; link: string }>('/v1/friends').then((r) => { setFriends(r.data); setLink(r.link); }).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => {
    refresh().catch(() => {});
    loadFriends();
    api<{ unread: number }>('/v1/notifications').then((r) => setUnread(r.unread)).catch(() => {});
  }, [refresh, loadFriends]));

  const friendTabs = new Set(friends.map((f) => f.tab_id).filter(Boolean) as string[]);
  // Friends you don't have a tab with yet (with a tab, they're already in People).
  const tabIds = new Set(people.map((p) => p.id));
  const noTabYet = friends.filter((f) => !f.tab_id || !tabIds.has(f.tab_id));

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
              <T v="small" style={{ color: '#FFFFFF', fontFamily: HT.font.bold, fontSize: 12 }}>Confirm {formatCents(g.to_confirm_cents)}</T>
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title} from your list`} onPress={() => hide(g, title)}
            style={{ width: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: HT.color.brand, borderRadius: HT.radius.tile, marginVertical: 6, marginLeft: 8 }}>
            <T v="strong" style={{ color: '#FFFFFF', fontSize: 13 }}>Remove</T>
          </Pressable>
        )}>
        <View style={{ backgroundColor: HT.color.surface }}>{row}</View>
      </ReanimatedSwipeable>
    );
  };

  async function hide(g: HouseholdSummary, title: string) {
    try {
      await api(`/v1/households/${g.id}/hide`, { body: {} });
      await refresh();
      toast.show({ text: `Removed ${title}. It comes back if anything new is added.`, ms: 5000,
        action: { label: 'Undo', run: () => { api(`/v1/households/${g.id}/hide`, { method: 'DELETE' }).then(() => refresh()).catch(() => {}); } } });
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't remove it." });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ width: '100%', maxWidth: HT.maxWidth.form + (wide ? 240 : 0), alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="display" accessibilityRole="header">Friends</T>
            <NotificationBell unread={unread} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Action icon={<SendIcon size={18} color={HT.color.brand} />} title="Settle up with someone" sub="One person owes the other" onPress={() => router.push('/request-friend' as Href)} />
            <Action icon={<GroupIcon size={22} color={HT.color.brand} />} title="Start a group" sub="A trip, dinners, anything shared" onPress={() => router.push('/group/new' as Href)} />
            <Action icon={<AddPersonIcon size={20} color={HT.color.brand} />} title="Add a friend" sub="Send each other requests in the app" onPress={inviteFriend} />
          </View>

          {all.length === 0 && friends.length === 0 ? (
            <Card style={{ gap: 8, paddingVertical: 22 }}>
              <T v="heading" style={{ fontSize: 17 }}>Split with anyone, not just roommates</T>
              <T v="muted">
                Covered lunch for a co-worker? Settle up with just them. Going on a trip? Start a group: everyone adds what they paid, even when two people split the hotel, and Gloslate finds the fewest payments to settle everyone.
              </T>
            </Card>
          ) : null}

          {people.length > 0 || noTabYet.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T v="heading">People</T>
              <Card style={{ paddingVertical: 4 }}>
                {people.map((g, i) => renderRow(g, i, people, true, friendTabs.has(g.id)))}
                {noTabYet.map((f, i) => (
                  <Pressable key={f.user_id} accessibilityRole="button" accessibilityLabel={`${f.first_name}, friend. Start a tab.`} onPress={() => openFriend(f)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1,
                      borderTopWidth: i > 0 || people.length > 0 ? 1 : 0, borderTopColor: HT.color.hairline })}>
                    <Avatar name={f.first_name} index={((people.length + i) % 4) + 1} size={44} />
                    <View style={{ flex: 1 }}>
                      <T v="strong" numberOfLines={1}>{f.first_name}{f.last_initial ? ` ${f.last_initial}.` : ''}</T>
                      <T v="small">Friend · no tab yet</T>
                    </View>
                    <T v="strong" style={{ color: HT.color.brand, fontSize: 13 }}>Start a tab</T>
                    <ChevronIcon size={18} color={HT.color.muted} />
                  </Pressable>
                ))}
              </Card>
            </View>
          ) : null}

          {groups.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T v="heading">Groups</T>
              <Card style={{ paddingVertical: 4 }}>{groups.map((g, i) => renderRow(g, i, groups, false))}</Card>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
