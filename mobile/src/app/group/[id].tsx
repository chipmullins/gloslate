import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/expense-row';
import { ArrowIcon } from '@/components/group-icons';
import { BackIcon, PlusIcon, ShareIcon } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, IconButton, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Expense, type Transfer } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { shareLink } from '@/lib/share';

/** One group: where you stand, the fewest payments to settle everyone, and what's been spent. */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { home: group, reload, error: loadError } = useHousehold(id);
  const { wide, gutter } = useLayout();
  const [items, setItems] = useState<Expense[] | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api<{ data: Expense[] }>(`/v1/households/${id}/expenses?limit=100`).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [id]));

  if (!group) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }}><ErrorNote message={loadError} /></SafeAreaView>;
  }

  const byId = new Map(group.members.map((m, i) => [m.id, { ...m, index: i }]));
  const me = group.me;
  const nameOf = (mid: string) => (mid === me.id ? 'You' : byId.get(mid)?.first_name ?? 'Former member');
  const net = group.balance.net_cents;
  const plan = group.settle_plan;
  const mine = plan.filter((t) => t.from_member_id === me.id || t.to_member_id === me.id);
  const others = plan.filter((t) => !mine.includes(t));

  async function addPerson() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await api(`/v1/households/${id}/members`, { body: { display_name: name } });
      setNewName('');
      setAdding(false);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add them.");
    }
  }

  async function invite(memberId: string) {
    try {
      const res = await api<{ data: { url: string; message: string } }>(`/v1/households/${id}/invites`, { body: { member_id: memberId } });
      await shareLink(res.data.message, res.data.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't make an invite link.");
    }
  }

  const openTransfer = (t: Transfer) =>
    router.push(`/group/settle?hid=${id}&from=${t.from_member_id}&to=${t.to_member_id}` as Href);

  const transferRow = (t: Transfer, i: number, list: Transfer[], tappable: boolean) => {
    const youPay = t.from_member_id === me.id;
    const color = !tappable ? HT.color.ink : youPay ? HT.color.youOwe : HT.color.owedToYou;
    const label = `${nameOf(t.from_member_id)} ${youPay ? 'pay' : 'pays'} ${t.to_member_id === me.id ? 'you' : nameOf(t.to_member_id)} ${formatCents(t.cents)}`;
    return (
      <Pressable key={`${t.from_member_id}-${t.to_member_id}`} disabled={!tappable} accessibilityRole={tappable ? 'button' : 'text'} accessibilityLabel={label}
        onPress={() => openTransfer(t)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, opacity: pressed ? 0.7 : 1,
          borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline })}>
        <Avatar name={byId.get(t.from_member_id)?.first_name ?? '?'} index={byId.get(t.from_member_id)?.index} size={34} />
        <ArrowIcon />
        <Avatar name={byId.get(t.to_member_id)?.first_name ?? '?'} index={byId.get(t.to_member_id)?.index} size={34} />
        <T v="strong" style={{ flex: 1 }} numberOfLines={2}>
          {nameOf(t.from_member_id)} {youPay ? 'pay' : 'pays'} {t.to_member_id === me.id ? 'you' : nameOf(t.to_member_id)}
        </T>
        <Money cents={t.cents} size={16} color={color} />
      </Pressable>
    );
  };

  const summary = (
    <Card dark style={{ gap: 6, paddingVertical: 22 }}>
      <T v="strong" style={{ color: HT.color.darkCardMuted }}>{net === 0 ? "You're all settled" : net > 0 ? "You're owed" : 'You owe'}</T>
      <Money cents={Math.abs(net)} size={44} color={net > 0 ? HT.color.onDarkOwed : net < 0 ? HT.color.onDarkOwe : '#FFFFFF'} />
      <T v="small" style={{ color: HT.color.darkCardMuted }}>
        {formatCents(group.total_spent_cents)} spent · {group.members.filter((m) => !m.former).length} people
      </T>
      <Button kind="onDark" title="Add what you paid" icon={<PlusIcon size={16} color="#FFFFFF" />} onPress={() => router.push(`/add?hid=${id}` as Href)} style={{ marginTop: 10 }} />
    </Card>
  );

  const settle = (
    <View style={{ gap: 8 }}>
      <T v="heading">Settle up</T>
      <Card style={{ paddingVertical: 4 }}>
        {plan.length === 0 ? (
          <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>{items?.length ? 'Everyone is even.' : 'Add what people paid and the plan shows up here.'}</T>
        ) : (
          <>
            {mine.map((t, i) => transferRow(t, i, mine, true))}
            {mine.length && others.length ? <View style={{ height: 1, backgroundColor: HT.color.hairline }} /> : null}
            {others.map((t, i) => transferRow(t, i, others, false))}
          </>
        )}
      </Card>
      {plan.length > 0 ? <T v="small">The fewest payments that settle everyone. Gloslate never moves money: pay in Venmo, Cash App or Zelle, then mark it paid.</T> : null}
    </View>
  );

  const people = (
    <View style={{ gap: 8 }}>
      <T v="heading">People</T>
      <Card style={{ paddingVertical: 4 }}>
        {group.members.filter((m) => !m.former).map((m, i, list) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <Avatar name={m.first_name} index={byId.get(m.id)?.index} size={34} />
            <T v="strong" style={{ flex: 1 }}>{m.you ? `${m.first_name} (you)` : m.display_name}</T>
            {m.placeholder ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Send ${m.first_name} a link to join`} onPress={() => invite(m.id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, opacity: pressed ? 0.6 : 1 })}>
                <ShareIcon size={16} color={HT.color.brand} />
                <T v="strong" style={{ color: HT.color.brand, fontSize: 13 }}>Invite</T>
              </Pressable>
            ) : null}
          </View>
        ))}
        {adding ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <TextInput value={newName} onChangeText={setNewName} placeholder="Their name" placeholderTextColor={HT.color.faint} autoFocus maxLength={40}
              accessibilityLabel="New person's name" onSubmitEditing={addPerson} returnKeyType="done" autoCapitalize="words"
              style={{ flex: 1, height: 48, paddingVertical: 0, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder,
                fontFamily: HT.font.semibold, fontSize: 15, color: HT.color.ink }} />
            <Button title="Add" onPress={addPerson} disabled={!newName.trim()} style={{ paddingHorizontal: 18 }} />
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, opacity: pressed ? 0.6 : 1 })}>
            <PlusIcon size={16} color={HT.color.brand} />
            <T v="strong" style={{ color: HT.color.brand }}>Add someone</T>
          </Pressable>
        )}
      </Card>
      <ErrorNote message={error} />
    </View>
  );

  const list = (
    <View style={{ gap: 8 }}>
      <T v="heading">What's been paid</T>
      <Card style={{ paddingVertical: 4 }}>
        {items === null ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Loading…</T> : null}
        {items?.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Nothing yet. Add the first thing someone paid for.</T> : null}
        {(items ?? []).map((e, i) => (
          <ExpenseRow key={e.id} e={e} members={group.members} last={i === (items?.length ?? 0) - 1} onPress={() => router.push(`/expense/${e.id}` as Href)} />
        ))}
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 8, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }}>
            <IconButton label="Back" onPress={() => router.back()}><BackIcon /></IconButton>
            <T v="display" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 26 }}>
              {group.members.filter((m) => !m.former).length === 2 ? group.members.find((m) => !m.you && !m.former)?.display_name ?? group.name : group.name}
            </T>
          </View>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 5, gap: 18 }}>{summary}{settle}{people}</View>
              <View style={{ flex: 6 }}>{list}</View>
            </View>
          ) : (
            <>{summary}{settle}{list}{people}</>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
