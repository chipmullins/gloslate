import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { RoundButton } from '@/components/stat-card';
import { Avatar, Button, Card, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { receiptDraft } from '@/lib/draft';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { itemize, pickedExtras, type AssignedItem } from '@/lib/receipt';
import { goBack } from '@/lib/nav';

function toInput(c: number) {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** Tap who had each item. Tax and tip split in proportion to what each person ordered. */
export default function Itemize() {
  const { payerId, hid } = useLocalSearchParams<{ payerId: string; hid?: string }>();
  const { home } = useHousehold(hid);
  const { wide } = useLayout();
  const draft = receiptDraft.get();
  const members = (home?.members ?? []).filter((m) => !m.former);
  const everyone = members.map((m) => m.id);

  const [rows, setRows] = useState<{ name: string; amount: string; memberIds: string[] | null; on: boolean }[]>(
    (draft?.items.length ? draft.items : [{ name: '', cents: 0, memberIds: [], skipped: false }])
      .map((i) => ({ name: i.name, amount: i.cents ? toInput(i.cents) : '', memberIds: i.memberIds.length ? i.memberIds : null, on: !i.skipped })),
  );
  const [tax, setTax] = useState(draft?.taxCents ? toInput(draft.taxCents) : '');
  const [tip, setTip] = useState(draft?.tipCents ? toInput(draft.tipCents) : '');

  const items: (AssignedItem & { skipped: boolean })[] = rows.map((r) => ({ name: r.name.trim() || 'Item', cents: parseCents(r.amount) ?? 0, memberIds: r.memberIds ?? everyone, skipped: !r.on }));
  // Only the items you picked count; the receipt's tax and tip are scaled to them.
  const picked: AssignedItem[] = items.filter((i) => !i.skipped).map(({ skipped: _s, ...i }) => i);
  const allCents = items.reduce((a, i) => a + i.cents, 0);
  const pickedCents = picked.reduce((a, i) => a + i.cents, 0);
  const receiptTax = parseCents(tax) ?? 0;
  const receiptTip = parseCents(tip) ?? 0;
  const { taxCents, tipCents } = pickedExtras(allCents, pickedCents, receiptTax, receiptTip);
  const partial = pickedCents < allCents;
  const payer = payerId || home?.me.id || '';
  const split = itemize(picked, taxCents, tipCents, payer); // cheap; React Compiler memoizes
  const total = Object.values(split).reduce((a, b) => a + b, 0);
  const scanned = draft?.totalCents ?? null;
  const unassigned = picked.some((i) => i.cents > 0 && i.memberIds.length === 0);
  const pickedCount = rows.filter((r) => r.on).length;
  const allOn = pickedCount === rows.length;

  /** Split = everyone shares it. Tapping a person while it's split makes it theirs in full; in a group,
   *  tapping more people shares it between just them. Nobody left (or everyone) goes back to Split. */
  function owe(row: number, mid: string | null) {
    setRows((cur) => cur.map((r, i) => {
      if (i !== row) return r;
      if (mid === null) return { ...r, memberIds: null };
      const list = r.memberIds;
      if (!list || list.length === everyone.length) return { ...r, memberIds: [mid] };
      const next = list.includes(mid) ? list.filter((x) => x !== mid) : [...list, mid];
      return { ...r, memberIds: next.length === 0 || next.length === everyone.length ? null : next };
    }));
  }

  function done() {
    const participantIds = Object.keys(split).filter((k) => split[k] > 0);
    // set, not patch: "Split by item" opens with no scan behind it.
    receiptDraft.set({ photoUri: draft?.photoUri ?? null, totalCents: draft?.totalCents ?? null, items, taxCents: receiptTax, tipCents: receiptTip,
      result: { amountCents: total, weights: split, participantIds, picked, taxCents, tipCents } });
    goBack();
  }

  const list = (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <Card key={i} style={{ gap: 10, padding: 14, opacity: r.on ? 1 : 0.55 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.on }} accessibilityLabel={`Split ${r.name || `item ${i + 1}`}`} hitSlop={8}
              onPress={() => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -6 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: r.on ? 0 : 1.5, borderColor: HT.color.chipBorder,
                backgroundColor: r.on ? HT.color.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {r.on ? <CheckIcon size={16} color={HT.color.ground} /> : null}
              </View>
            </Pressable>
            <TextInput keyboardAppearance={HT.scheme} value={r.name} onChangeText={(t) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, name: t } : x)))} placeholder="Item"
              placeholderTextColor={HT.color.faint} accessibilityLabel={`Item ${i + 1} name`} maxLength={60}
              style={{ flex: 1, minWidth: 0, height: 48, paddingVertical: 0, fontFamily: HT.font.bold, fontSize: 15.5, color: HT.color.ink }} />
            <TextInput keyboardAppearance={HT.scheme} value={r.amount} onChangeText={(t) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, amount: centsFirst(t) } : x)))} placeholder="0.00"
              placeholderTextColor={HT.color.faint} keyboardType="number-pad" accessibilityLabel={`Item ${i + 1} amount`}
              style={{ width: 90, flexShrink: 0, height: 48, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 10, textAlign: 'right', fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
            <IconButton label={`Remove item ${i + 1}`} onPress={() => setRows((cur) => cur.filter((_, j) => j !== i))}><TrashIcon size={18} color={HT.color.muted} /></IconButton>
          </View>
          {r.on && members.length > 1 ? (() => {
            const ids = r.memberIds;
            const split = !ids || ids.length === everyone.length;
            const solo = !split && ids.length === 1 ? members.find((m) => m.id === ids[0]) : null;
            const cents = parseCents(r.amount) ?? 0;
            const pill = (key: string, label: string, on: boolean, onPress: () => void, a11y: string) => (
              <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={a11y} onPress={onPress}
                style={({ pressed }) => ({ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', borderWidth: 1,
                  borderColor: on ? HT.color.ink : HT.color.chipBorder, backgroundColor: on ? HT.color.ink : HT.color.surface, opacity: pressed ? 0.75 : 1 })}>
                <T v="strong" style={{ fontSize: 13.5, color: on ? HT.color.ground : HT.color.ink }}>{label}</T>
              </Pressable>
            );
            return (
              <View style={{ gap: 6, paddingLeft: 38 }}>
                <View accessibilityRole="radiogroup" accessibilityLabel={`Who owes ${r.name || 'this item'}`} style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {pill('split', 'Split', split, () => owe(i, null), `Split ${r.name || 'this item'} with everyone`)}
                  {members.map((m) => {
                    const who = m.you ? 'You' : m.first_name;
                    return pill(m.id, who, !split && ids.includes(m.id), () => owe(i, m.id), m.you ? `You pay all of ${r.name || 'this'}` : `${m.first_name} owes all of ${r.name || 'this'}`);
                  })}
                </View>
                {solo ? (
                  <T v="small" style={{ color: solo.you ? HT.color.muted : HT.color.owedToYou }}>
                    {solo.you ? `All yours${cents ? `, ${formatCents(cents)}` : ''}` : `${solo.first_name} owes all of it${cents ? `, ${formatCents(cents)}` : ''}`}
                  </T>
                ) : !split ? <T v="small">Shared by {ids.length}</T> : null}
              </View>
            );
          })() : null}
        </Card>
      ))}
      <Button title="Add an item" kind="secondary" icon={<PlusIcon size={16} />} onPress={() => setRows((cur) => [...cur, { name: '', amount: '', memberIds: null, on: true }])} />
    </View>
  );

  const summary = (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="label">Tax</T>
          <TextInput keyboardAppearance={HT.scheme} value={tax} onChangeText={(t) => setTax(centsFirst(t))} keyboardType="number-pad" placeholder="0.00" placeholderTextColor={HT.color.faint} accessibilityLabel="Tax"
            style={{ height: 52, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 12, fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="label">Tip</T>
          <TextInput keyboardAppearance={HT.scheme} value={tip} onChangeText={(t) => setTip(centsFirst(t))} keyboardType="number-pad" placeholder="0.00" placeholderTextColor={HT.color.faint} accessibilityLabel="Tip"
            style={{ height: 52, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 12, fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
        </View>
      </View>
      <T v="small">{partial
        ? `For the ${pickedCount} item${pickedCount === 1 ? '' : 's'} you picked: ${formatCents(taxCents)} tax and ${formatCents(tipCents)} tip, the same share of the receipt. Split by what each person had.`
        : 'Tax and tip split in proportion to what each person had.'}</T>
      <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
      {members.map((m, mi) => (split[m.id] ? (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar photo={m.photo_url} name={m.first_name} index={mi} size={28} />
          <T v="strong" style={{ flex: 1 }}>{m.you ? 'You' : m.first_name}</T>
          <Money cents={split[m.id]} />
        </View>
      ) : null))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="heading">Total</T><Money cents={total} size={17} />
      </View>
      {scanned !== null && !partial && scanned !== total ? <T v="small" style={{ color: HT.color.youOwe }}>The receipt says {formatCents(scanned)}. Check the items, tax and tip.</T> : null}
    </Card>
  );

  return (
    <Screen maxWidth={wide ? 1000 : HT.maxWidth.form}
      footer={<Button kind="accent" title={total ? `Use ${formatCents(total)}${partial ? ` for ${pickedCount} item${pickedCount === 1 ? '' : 's'}` : ''}` : 'Pick an item'} onPress={done} disabled={!total || unassigned} />}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <RoundButton label="Close" onPress={() => goBack()}><CloseIcon size={20} /></RoundButton>
          <T v="hero" accessibilityRole="header" style={{ flex: 1, fontSize: 30, lineHeight: 36 }} numberOfLines={1} adjustsFontSizeToFit>{draft?.photoUri ? 'Receipt items' : 'Split by item'}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T v="muted" style={{ flex: 1 }}>{members.length > 1 ? 'Check what counts. Split an item, or tap a person to make it theirs in full.' : 'Check what counts.'}</T>
          {rows.length > 1 ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setRows((cur) => cur.map((x) => ({ ...x, on: !allOn })))}>
              <T v="strong" style={{ fontSize: 13.5, color: HT.color.brand }}>{allOn ? 'Clear all' : 'Pick all'}</T>
            </Pressable>
          ) : null}
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
