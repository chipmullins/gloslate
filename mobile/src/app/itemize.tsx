import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CloseIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { Avatar, Button, Card, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { receiptDraft } from '@/lib/draft';
import { formatCents, parseCents } from '@/lib/money';
import { itemize, type AssignedItem } from '@/lib/receipt';

function toInput(c: number) {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** Tap who had each item. Tax and tip split in proportion to what each person ordered. */
export default function Itemize() {
  const { payerId } = useLocalSearchParams<{ payerId: string }>();
  const { home } = useHousehold();
  const { wide } = useLayout();
  const draft = receiptDraft.get();
  const members = (home?.members ?? []).filter((m) => !m.former);
  const everyone = members.map((m) => m.id);

  const [rows, setRows] = useState<{ name: string; amount: string; memberIds: string[] | null }[]>(
    (draft?.items.length ? draft.items : [{ name: '', cents: 0, memberIds: [] }]).map((i) => ({ name: i.name, amount: i.cents ? toInput(i.cents) : '', memberIds: i.memberIds.length ? i.memberIds : null })),
  );
  const [tax, setTax] = useState(draft?.taxCents ? toInput(draft.taxCents) : '');
  const [tip, setTip] = useState(draft?.tipCents ? toInput(draft.tipCents) : '');

  const items: AssignedItem[] = rows.map((r) => ({ name: r.name.trim() || 'Item', cents: parseCents(r.amount) ?? 0, memberIds: r.memberIds ?? everyone }));
  const taxCents = parseCents(tax) ?? 0;
  const tipCents = parseCents(tip) ?? 0;
  const payer = payerId || home?.me.id || '';
  const split = itemize(items, taxCents, tipCents, payer); // cheap; React Compiler memoizes
  const total = Object.values(split).reduce((a, b) => a + b, 0);
  const scanned = draft?.totalCents ?? null;
  const unassigned = items.some((i) => i.cents > 0 && i.memberIds.length === 0);

  function toggle(row: number, mid: string) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== row) return r;
      const list = r.memberIds ?? everyone;
      return { ...r, memberIds: list.includes(mid) ? list.filter((x) => x !== mid) : [...list, mid] };
    }));
  }

  function done() {
    const participantIds = Object.keys(split).filter((k) => split[k] > 0);
    receiptDraft.patch({ items, taxCents, tipCents, result: { amountCents: total, weights: split, participantIds } });
    router.back();
  }

  const list = (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <Card key={i} style={{ gap: 10, padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={r.name} onChangeText={(t) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, name: t } : x)))} placeholder="Item"
              placeholderTextColor={HT.color.faint} accessibilityLabel={`Item ${i + 1} name`} maxLength={60}
              style={{ flex: 1, height: 48, paddingVertical: 0, fontFamily: HT.font.bold, fontSize: 15.5, color: HT.color.ink }} />
            <TextInput value={r.amount} onChangeText={(t) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, amount: t } : x)))} placeholder="0.00"
              placeholderTextColor={HT.color.faint} keyboardType="decimal-pad" accessibilityLabel={`Item ${i + 1} amount`}
              style={{ width: 104, height: 48, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 10, textAlign: 'right', fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
            <IconButton label={`Remove item ${i + 1}`} onPress={() => setRows((cur) => cur.filter((_, j) => j !== i))}><TrashIcon size={18} color={HT.color.muted} /></IconButton>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {members.map((m, mi) => {
              const on = (r.memberIds ?? everyone).includes(m.id);
              return (
                <Pressable key={m.id} accessibilityRole="checkbox" accessibilityLabel={`${m.you ? 'You' : m.first_name} had ${r.name || 'this'}`} accessibilityState={{ checked: on }}
                  onPress={() => toggle(i, m.id)} style={{ alignItems: 'center', gap: 2, opacity: on ? 1 : 0.35, minWidth: 44 }}>
                  <View style={{ borderRadius: 22, padding: 2, borderWidth: 2, borderColor: on ? HT.color.brand : 'transparent' }}><Avatar name={m.first_name} index={mi} size={34} /></View>
                  <T v="small">{m.you ? 'You' : m.first_name}</T>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
      <Button title="Add an item" kind="secondary" icon={<PlusIcon size={16} />} onPress={() => setRows((cur) => [...cur, { name: '', amount: '', memberIds: null }])} />
    </View>
  );

  const summary = (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="label">Tax</T>
          <TextInput value={tax} onChangeText={setTax} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={HT.color.faint} accessibilityLabel="Tax"
            style={{ height: 52, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 12, fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="label">Tip</T>
          <TextInput value={tip} onChangeText={setTip} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={HT.color.faint} accessibilityLabel="Tip"
            style={{ height: 52, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 12, fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
        </View>
      </View>
      <T v="small">Tax and tip split in proportion to what each person had.</T>
      <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
      {members.map((m, mi) => (split[m.id] ? (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={m.first_name} index={mi} size={28} />
          <T v="strong" style={{ flex: 1 }}>{m.you ? 'You' : m.first_name}</T>
          <Money cents={split[m.id]} />
        </View>
      ) : null))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="heading">Total</T><Money cents={total} size={17} />
      </View>
      {scanned !== null && scanned !== total ? <T v="small" style={{ color: HT.color.youOwe }}>The receipt says {formatCents(scanned)}. Check the items, tax and tip.</T> : null}
    </Card>
  );

  return (
    <Screen maxWidth={wide ? 1000 : HT.maxWidth.form} footer={<Button title={total ? `Use ${formatCents(total)}` : 'Add items'} onPress={done} disabled={!total || unassigned} />}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Close" onPress={() => router.back()}><CloseIcon /></IconButton>
          <T v="heading" accessibilityRole="header">Who had what</T>
          <View style={{ width: 44 }} />
        </View>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={{ flex: 3 }}>{list}</View>
            <View style={{ flex: 2 }}>{summary}</View>
          </View>
        ) : (
          <>{list}{summary}</>
        )}
      </View>
    </Screen>
  );
}
