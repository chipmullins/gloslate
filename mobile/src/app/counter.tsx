import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CloseIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { Button, Card, ErrorNote, Field, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Breakdown } from '@/lib/api';
import { formatCents, parseCents } from '@/lib/money';
import { equalSplit, newClientId } from '@/lib/split';
import { toast } from '@/lib/toast';

const MAX_ITEMS = 10;
type Row = { key: string; description: string; amount: string };
const blank = (): Row => ({ key: newClientId(), description: '', amount: '' });

/**
 * "Actually, I paid for some things too." From a request (or anytime you owe
 * someone), add what you covered. Each item is split evenly between the two of
 * you, the balance nets on the spot, and they get one notification.
 */
export default function Counter() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { home } = useHousehold();
  const { wide } = useLayout();
  const [before, setBefore] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const other = home?.members.find((m) => m.id === memberId);
  const me = home?.me;

  useEffect(() => {
    if (!home) return;
    api<{ data: Breakdown }>(`/v1/households/${home.id}/balances/${memberId}`)
      .then((r) => setBefore(r.data.net_cents))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the balance."));
  }, [home, memberId]);

  // Same rule as the server: split evenly between the two of you, odd cent to you (the payer).
  const items = useMemo(() => rows.map((r) => ({ ...r, cents: parseCents(r.amount) ?? 0 })), [rows]);
  const total = items.reduce((s, i) => s + i.cents, 0);
  const theirShare = me && other ? items.reduce((s, i) => s + (i.cents > 0 ? equalSplit(i.cents, me.id, [me.id, other.id])[other.id] ?? 0 : 0), 0) : 0;
  const after = before === null ? null : before + theirShare;
  const filled = items.filter((i) => i.cents > 0);

  function update(key: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const describe = (cents: number) => !other ? '' : cents < 0 ? `You'll send ${other.first_name} ${formatCents(-cents)}` : cents > 0 ? `${other.first_name} will owe you ${formatCents(cents)}` : `You two will be square`;

  async function save() {
    if (!home || !other || !filled.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: { after_cents: number } }>(`/v1/households/${home.id}/expenses/counter`, {
        body: { member_id: other.id, items: filled.map((i) => ({ description: i.description.trim(), amount_cents: i.cents, client_id: i.key })) },
      });
      router.back();
      toast.show({ text: `Added. ${describe(res.data.after_cents)}. ${other.first_name} has been told.`, ms: 4500 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (!home || !other || !me) return <Screen><ErrorNote message={error} /></Screen>;

  const summary = (
    <Card dark style={{ gap: 14, paddingVertical: 22 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="strong" style={{ color: HT.color.darkCardMuted }}>{before !== null && before < 0 ? `${other.first_name} asked for` : 'Balance now'}</T>
        <Money cents={Math.abs(before ?? 0)} size={17} color={HT.color.darkCardMuted} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="strong" style={{ color: HT.color.darkCardMuted }}>{other.first_name}'s half of your {filled.length || ''} item{filled.length === 1 ? '' : 's'}</T>
        <Money cents={theirShare} size={17} color={HT.color.onDarkOwed} sign />
      </View>
      <View style={{ height: 1, backgroundColor: HT.color.onDarkButton }} />
      <T v="strong" style={{ color: '#FFFFFF', fontSize: 15 }}>{after === null ? ' ' : describe(after)}</T>
      <Money cents={Math.abs(after ?? 0)} size={40} color="#FFFFFF" />
    </Card>
  );

  const list = (
    <View style={{ gap: 10 }}>
      {rows.map((r, idx) => (
        <View key={r.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label={idx === 0 ? 'What you paid for' : `Item ${idx + 1}`} hideLabel={idx > 0} value={r.description}
              onChangeText={(t) => update(r.key, { description: t })} placeholder={['Groceries', 'Internet', 'Takeout', 'Toilet paper'][idx % 4]} maxLength={80} />
          </View>
          <View style={{ width: 118 }}>
            <Field label={idx === 0 ? 'Amount' : `Item ${idx + 1} amount`} hideLabel={idx > 0} value={r.amount}
              onChangeText={(t) => update(r.key, { amount: t })} placeholder="0.00" keyboardType="decimal-pad" style={{ fontFamily: HT.font.mono, textAlign: 'right' }} />
          </View>
          {rows.length > 1 ? (
            <IconButton label={`Remove item ${idx + 1}`} onPress={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}><TrashIcon size={18} color={HT.color.muted} /></IconButton>
          ) : null}
        </View>
      ))}
      {rows.length < MAX_ITEMS ? (
        <Button title="Add another" kind="secondary" icon={<PlusIcon size={16} />} onPress={() => setRows((cur) => [...cur, blank()])} />
      ) : null}
      <T v="small">Each one is split evenly between you and {other.first_name}. {other.first_name} gets one notification with the new total and can question anything, like any expense.</T>
    </View>
  );

  return (
    <Screen maxWidth={wide ? 980 : HT.maxWidth.form}
      footer={<Button title={filled.length ? `Add ${filled.length} item${filled.length > 1 ? 's' : ''} · ${formatCents(total)}` : 'Add what you paid for'} onPress={save} loading={busy} disabled={!filled.length || before === null} />}>
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Close" onPress={() => router.back()}><CloseIcon /></IconButton>
          <T v="heading" accessibilityRole="header">I paid for some things too</T>
          <View style={{ width: 44 }} />
        </View>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={{ flex: 3 }}>{list}</View>
            <View style={{ flex: 2 }}>{summary}</View>
          </View>
        ) : (
          <>{summary}{list}</>
        )}
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
