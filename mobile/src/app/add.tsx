import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackIcon, CameraIcon, CheckIcon, CloseIcon, PencilIcon } from '@/components/icons';
import { applyKey, Keypad } from '@/components/keypad';
import { Avatar, Button, ErrorNote, IconButton, Screen, T } from '@/components/ui';
import { RoundButton } from '@/components/stat-card';
import { LoadState } from '@/components/load-state';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, CATEGORIES, uploadReceipt, type Expense, type Member } from '@/lib/api';
import { isOffline, outbox } from '@/lib/outbox';
import { receiptDraft } from '@/lib/draft';
import { scanReceipt } from '@/lib/receipt-scan';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { effectFor, equalSplit, newClientId } from '@/lib/split';
import { toast } from '@/lib/toast';
import { goBack } from '@/lib/nav';
import { useSession } from '@/lib/session';

type Kind = 'equal' | 'percent' | 'exact' | 'shares';
const KIND_LABEL: Record<Kind, string> = { equal: 'Equal', percent: '%', exact: '$', shares: 'Shares' };

/** "12.30": what cents-first inputs expect to keep typing onto. */
const twoDp = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

function centsToInput(c: number) {
  return c % 100 === 0 ? String(c / 100) : `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** Parses a split input to its integer weight: % → basis points, $ → cents, shares → integer. */
function weightOf(kind: Kind, raw: string): number | null {
  if (kind === 'shares') return /^\d{1,3}$/.test(raw) ? Number(raw) : null;
  return parseCents(raw);
}

/** One tap names it (and sets its category). */
const QUICK_PICKS = [
  { label: 'Groceries', category: 'groceries' },
  { label: 'Dinner', category: 'food' },
  { label: 'Takeout', category: 'food' },
  { label: 'Household supplies', category: 'household' },
];

export default function Add() {
  const { id, hid, pick } = useLocalSearchParams<{ id?: string; hid?: string; pick?: string }>();
  // Quick add on the website's Home opens with a pick already chosen.
  const quick = QUICK_PICKS.find((p) => p.label === pick);
  const editing = !!id;
  const { home, error: loadError, reload } = useHousehold(hid);
  const { households } = useSession();
  const { wide } = useLayout();

  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  // Several people paid: what each one put in, as typed.
  const [multi, setMulti] = useState(false);
  const [paid, setPaid] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<string[] | null>(null);
  const [category, setCategory] = useState(quick?.category ?? 'food');
  const [description, setDescription] = useState(quick?.label ?? '');
  const [urgency, setUrgency] = useState<'tab' | 'soon'>('tab');
  const [kind, setKind] = useState<Kind>('equal');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showSplit, setShowSplit] = useState(false);
  const [preview, setPreview] = useState<{ key: string; cents: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef(newClientId());
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [itemization, setItemization] = useState<object | null>(null);
  const [scanItems, setScanItems] = useState(0);

  // Coming back from Itemize: use its exact split.
  useFocusEffect(useCallback(() => {
    const d = receiptDraft.get();
    if (!d?.result) return;
    setAmount(`${Math.floor(d.result.amountCents / 100)}.${String(d.result.amountCents % 100).padStart(2, '0')}`);
    setKind('exact');
    setIncluded(d.result.participantIds);
    setInputs(Object.fromEntries(Object.entries(d.result.weights).map(([k, v]) => [k, `${Math.floor(v / 100)}.${String(v % 100).padStart(2, '0')}`])));
    setItemization({ items: d.items.map((i) => ({ name: i.name, cents: i.cents, member_ids: i.memberIds })), tax_cents: d.taxCents, tip_cents: d.tipCents });
    setShowSplit(true);
    receiptDraft.patch({ result: undefined });
  }, []));

  async function scan(source: 'camera' | 'library') {
    setError(null);
    try {
      const r = await scanReceipt(source);
      if (!r) return;
      setPhotoUri(r.uri);
      receiptDraft.set({ photoUri: r.uri, items: (r.parsed?.items ?? []).map((i) => ({ ...i, memberIds: [] })), taxCents: r.parsed?.taxCents ?? 0,
        tipCents: r.parsed?.tipCents ?? 0, totalCents: r.parsed?.totalCents ?? null });
      if (r.parsed?.totalCents) {
        const t = r.parsed.totalCents;
        setAmount(`${Math.floor(t / 100)}.${String(t % 100).padStart(2, '0')}`);
      }
      setScanItems(r.parsed?.items.length ?? 0);
      if (!r.parsed) toast.show({ text: 'Photo attached. Type the total on the keypad.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't scan that receipt.");
    }
  }

  const members: (Member & { index: number })[] = useMemo(
    () => (home?.members ?? []).map((m, index) => ({ ...m, index })).filter((m) => !m.former),
    [home],
  );
  const me = home?.me;
  const paidCents = useMemo(() => Object.fromEntries(members.map((m) => [m.id, parseCents(paid[m.id] ?? '') ?? 0])), [members, paid]);
  const paidTotal = Object.values(paidCents).reduce((a, b) => a + b, 0);
  // The biggest payer is the main one (they also take any odd cent), like the server.
  const mainPayer = multi ? members.reduce<string | null>((best, m) => (paidCents[m.id] > (best ? paidCents[best] : 0) ? m.id : best), null) : null;
  const payer = mainPayer ?? payerId ?? me?.id ?? '';
  const ids = included ?? members.map((m) => m.id);
  const cents = parseCents(amount) ?? 0;
  const couple = members.length === 2;

  // Edit: load and prefill.
  useEffect(() => {
    if (!id) return;
    api<{ data: Expense }>(`/v1/expenses/${id}`).then(({ data: e }) => {
      setAmount(centsToInput(e.amount_cents));
      setPayerId(e.payer_id);
      if ((e.payers?.length ?? 0) > 1) {
        setMulti(true);
        setPaid(Object.fromEntries(e.payers!.map((p) => [p.member_id, twoDp(p.cents)])));
      }
      setIncluded(e.shares.map((s) => s.member_id));
      setCategory(e.category);
      setDescription(e.description);
      setUrgency(e.urgency);
      setKind(e.split_kind);
      if (e.split_kind !== 'equal') {
        setInputs(Object.fromEntries(Object.entries(e.split_weights).map(([k, v]) =>
          [k, e.split_kind === 'shares' ? String(v) : centsToInput(v)])));
        setShowSplit(true);
      }
    }).catch(() => setError("Couldn't load this expense."));
  }, [id]);

  const weights = useMemo(() => {
    if (kind === 'equal') return null;
    const w: Record<string, number> = {};
    for (const mid of ids) {
      const v = weightOf(kind, inputs[mid] ?? '');
      if (v === null) return null;
      w[mid] = v;
    }
    return w;
  }, [kind, ids, inputs]);

  const weightTotal = weights ? Object.values(weights).reduce((a, b) => a + b, 0) : 0;
  const splitIssue = (() => {
    if (ids.length === 0) return 'Pick at least one person';
    if (multi && cents > 0 && paidTotal !== cents) {
      return paidTotal < cents ? `${formatCents(cents - paidTotal)} left to say who paid` : `Who paid adds up to ${formatCents(paidTotal - cents)} too much`;
    }
    if (kind === 'equal') return null;
    if (!weights) return kind === 'shares' ? 'Give everyone a whole number of shares' : 'Fill in everyone';
    if (kind === 'percent' && weightTotal !== 10000) return `Adds up to ${centsToInput(weightTotal)}%, needs 100%`;
    if (kind === 'exact' && weightTotal !== cents) return weightTotal < cents ? `${formatCents(cents - weightTotal)} left to assign` : `${formatCents(weightTotal - cents)} too much`;
    if (kind === 'shares' && weightTotal === 0) return 'Shares must add up to more than zero';
    return null;
  })();

  // Equal splits compute instantly; other splits ask the server (debounced).
  const previewable = kind !== 'equal' && !multi && !splitIssue && cents > 0 && !!home;
  const idsKey = ids.join(',');
  const weightsKey = JSON.stringify(weights);
  const homeId = home?.id;
  useEffect(() => {
    if (!previewable || !homeId) return;
    const t = setTimeout(() => {
      api<{ data: { effect_for_me_cents: number } }>(`/v1/households/${homeId}/expenses/preview`, {
        body: { amount_cents: cents, payer_id: payer, participant_ids: idsKey.split(','), split_kind: kind, split_weights: JSON.parse(weightsKey) },
      }).then((r) => setPreview({ key: `${cents}|${payer}|${idsKey}|${kind}|${weightsKey}`, cents: r.data.effect_for_me_cents })).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [previewable, homeId, cents, payer, idsKey, kind, weightsKey]);
  const previewCents = previewable && preview?.key === `${cents}|${payer}|${idsKey}|${kind}|${weightsKey}` ? preview.cents : null;

  const effect = kind === 'equal' && me
    ? multi ? (paidCents[me.id] ?? 0) - (equalSplit(cents, payer, ids)[me.id] ?? 0) : effectFor(me.id, payer, equalSplit(cents, payer, ids))
    : previewCents;
  const perHead = ids.length ? Math.floor(cents / ids.length) : 0;
  const nameOf = (mid: string) => members.find((m) => m.id === mid)?.first_name ?? '';

  const label = (() => {
    const verb = editing ? 'Save' : 'Add';
    if (cents <= 0) return 'Enter an amount';
    if (splitIssue) return splitIssue;
    if (effect == null) return verb;
    if (effect === 0) return `${verb} · doesn't change your balance`;
    const owing = members.filter((m) => !m.you && ids.includes(m.id));
    if (multi) return effect > 0 ? `${verb} · you're owed ${formatCents(effect)}` : `${verb} · you owe ${formatCents(-effect)}`;
    if (effect > 0) return couple || owing.length === 1 ? `${verb} · ${owing[0]?.first_name ?? 'They'} owes you ${formatCents(effect)}` : `${verb} · you're owed ${formatCents(effect)}`;
    return `${verb} · you owe ${nameOf(payer)} ${formatCents(-effect)}`;
  })();

  async function save() {
    if (!home || cents <= 0 || splitIssue) return;
    setBusy(true);
    setError(null);
    const body = {
      amount_cents: cents, payer_id: payer, participant_ids: ids, split_kind: kind, split_weights: weights ?? {},
      category, description: description.trim(), urgency: payer === me?.id && !multi ? urgency : 'tab',
      ...(multi ? { payers: members.filter((m) => paidCents[m.id] > 0).map((m) => ({ member_id: m.id, amount_cents: paidCents[m.id] })) } : {}),
      ...(itemization && kind === 'exact' ? { itemization } : {}),
    };
    try {
      if (editing) {
        await api(`/v1/expenses/${id}`, { method: 'PATCH', body });
        goBack((hid ? `/group/${hid}` : '/home') as Href);
        toast.show({ text: 'Saved. Everyone in it can see the change.' });
      } else {
        const res = await api<{ data: Expense }>(`/v1/households/${home.id}/expenses`, { body: { ...body, client_id: clientId.current } });
        if (photoUri) uploadReceipt(res.data.id, photoUri).catch(() => toast.show({ text: "Saved, but the receipt photo didn't upload." }));
        receiptDraft.set(null);
        goBack((hid ? `/group/${hid}` : '/home') as Href);
        const what = res.data.description || CATEGORIES.find((c) => c.key === category)?.label || 'Expense';
        toast.show({
          text: `Added ${what}`,
          ms: 5000,
          action: { label: 'Undo', run: () => { api(`/v1/expenses/${res.data.id}`, { method: 'DELETE' }).then(() => toast.show({ text: 'Removed' })); } },
        });
      }
    } catch (e) {
      if (!editing && isOffline(e)) {
        // No connection: keep it on this phone and send it when Gloslate is reachable.
        const what = description.trim() || CATEGORIES.find((c) => c.key === category)?.label || 'Expense';
        outbox.add({ clientId: clientId.current, householdId: home.id, label: what, amountCents: cents, body, photoUri });
        receiptDraft.set(null);
        goBack((hid ? `/group/${hid}` : '/home') as Href);
        toast.show({ text: `Saved ${what} on this phone. It'll be added when you're back online.`, ms: 5000 });
      } else {
        setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  }

  function toggle(mid: string) {
    setIncluded((cur) => {
      const list = cur ?? members.map((m) => m.id);
      return list.includes(mid) ? list.filter((x) => x !== mid) : [...list, mid];
    });
  }

  // Opened with nowhere to add it (Siri, a widget, or a friends-only account): send them to pick a tab.
  if (!hid && !households.some((h) => h.kind !== 'group')) return <NoTabToAdd />;
  if (!home || !me) return <LoadState error={loadError} onRetry={reload} />;

  const chip = (on: boolean) => ({
    minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: on ? HT.color.ink : HT.color.chipBorder, backgroundColor: on ? HT.color.ink : HT.color.surface,
  });
  const chipText = (on: boolean) => (on ? HT.color.ground : HT.color.ink);
  const others = members.filter((m) => !m.you).map((m) => m.first_name);
  const tabLabel = `${home.kind === 'group' ? home.name : home.name || 'Home'} · ${others.length === 1 ? `You & ${others[0]}` : `${members.length} people`}`;

  const amountBlock = (
    <View style={{ gap: 12, paddingTop: wide ? 24 : 0 }}>
      <View style={{ backgroundColor: HT.color.surface, borderRadius: HT.radius.card, borderWidth: 1, borderColor: HT.color.hairline, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 6 }}>
        <T numberOfLines={1} style={{ fontFamily: HT.font.label, fontSize: 11.5, letterSpacing: 2, color: HT.color.muted, textTransform: 'uppercase' }}>{tabLabel}</T>
        <Text accessibilityLabel={`Amount ${formatCents(cents)}`} adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.2}
          style={{ fontFamily: HT.font.monoBold, fontSize: wide ? 64 : 54, letterSpacing: -1.6, color: cents ? HT.color.ink : HT.color.faint, fontVariant: ['tabular-nums'] }}>
          {formatCents(cents)}
        </Text>
        <T v="muted">
          {kind === 'equal'
            ? ids.length === members.length ? `Split equally${cents ? ` · ${formatCents(perHead)} each` : ''}` : `Split between ${ids.length}${cents ? ` · ${formatCents(perHead)} each` : ''}`
            : `Split by ${kind === 'percent' ? 'percentage' : kind === 'exact' ? 'exact amounts' : 'shares'}`}
        </T>
        {!editing && photoUri && (scanItems > 1 || members.length > 2) ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/itemize?payerId=${payer}${hid ? `&hid=${hid}` : ''}` as Href)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: HT.color.ground,
              borderWidth: 1, borderColor: HT.color.chipBorder, opacity: pressed ? 0.7 : 1 })}>
            <T v="strong" style={{ fontSize: 13 }}>{itemization ? 'Edit items' : 'Who had what'}</T>
          </Pressable>
        ) : null}
        {/* What was it: its own labeled field, with quick picks under the card. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, marginTop: 4, paddingHorizontal: 14, borderRadius: HT.radius.tile,
          backgroundColor: HT.color.ground, borderWidth: 1.5, borderColor: description ? HT.color.ink : 'transparent' }}>
          <PencilIcon size={18} color={HT.color.muted} />
          <TextInput keyboardAppearance={HT.scheme} value={description} onChangeText={setDescription} placeholder="Add a name, like Costco run" placeholderTextColor={HT.color.faint}
            accessibilityLabel="What was it" accessibilityLabelledBy="whatLabel" maxLength={60} returnKeyType="done"
            style={{ flex: 1, height: 48, paddingVertical: 0, fontFamily: HT.font.medium, fontSize: 16, color: HT.color.ink }} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T v="strong" nativeID="whatLabel" style={{ fontSize: 15 }}>What was it?</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_PICKS.map((p) => {
            const on = description === p.label;
            return (
              <Pressable key={p.label} accessibilityRole="button" accessibilityLabel={`Call it ${p.label}`} accessibilityState={{ selected: on }}
                onPress={() => { setDescription(on ? '' : p.label); if (!editing && !on) setCategory(p.category); }}
                style={({ pressed }) => ({ ...chip(on), opacity: pressed ? 0.7 : 1 })}>
                <T v="strong" style={{ fontSize: 13.5, color: chipText(on) }}>{p.label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const severalPaid = (
    <View style={{ backgroundColor: HT.color.surface, borderRadius: HT.radius.card, padding: 16, gap: 10 }}>
      <T v="muted">Put in what each person paid. It has to add up to {cents ? formatCents(cents) : 'the total'}.</T>
      {members.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
          <Avatar photo={m.photo_url} name={m.first_name} index={m.index} size={32} />
          <T v="strong" style={{ flex: 1 }}>{m.you ? 'You' : m.first_name}</T>
          <T v="muted">$</T>
          <TextInput keyboardAppearance={HT.scheme} value={paid[m.id] ?? ''} onChangeText={(t) => setPaid((cur) => ({ ...cur, [m.id]: centsFirst(t) }))}
            keyboardType="number-pad" placeholder="0.00" placeholderTextColor={HT.color.faint}
            accessibilityLabel={`What ${m.you ? 'you' : m.first_name} paid`}
            style={{ width: 110, height: 48, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 10,
              textAlign: 'right', fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
        </View>
      ))}
      {cents > 0 && paidTotal !== cents ? (
        <T v="small" style={{ color: HT.color.youOwe }}>{paidTotal < cents ? `${formatCents(cents - paidTotal)} left` : `${formatCents(paidTotal - cents)} too much`}</T>
      ) : null}
    </View>
  );

  const whoPaid = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
        <T v="label">Who paid?</T>
        {members.length > 1 ? (
          <Pressable accessibilityRole="button" hitSlop={10}
            onPress={() => { setMulti((v) => !v); if (!multi && cents && me) setPaid({ [payerId ?? me.id]: twoDp(cents) }); }}>
            <T v="strong" style={{ fontSize: 13, color: HT.color.brand }}>{multi ? 'One person paid' : 'Several people paid'}</T>
          </Pressable>
        ) : null}
      </View>
      {multi ? severalPaid : couple ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 6 }}>
          {members.map((m) => {
            const on = payer === m.id;
            return (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityLabel={m.you ? 'You' : m.first_name} accessibilityState={{ checked: on }} onPress={() => setPayerId(m.id)}
                style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? HT.color.surface : 'transparent',
                  shadowColor: '#000', shadowOpacity: on ? 0.08 : 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
                <T v="strong" style={{ color: on ? HT.color.ink : HT.color.muted }}>{m.you ? 'You' : m.first_name}</T>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          {members.map((m) => {
            const on = payer === m.id;
            return (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityLabel={m.you ? 'You' : m.first_name} accessibilityState={{ checked: on }}
                onPress={() => setPayerId(m.id)} style={{ alignItems: 'center', gap: 4, minWidth: 52 }}>
                <View style={{ borderRadius: 26, padding: 2, borderWidth: 2, borderColor: on ? HT.color.brand : 'transparent' }}>
                  <Avatar photo={m.photo_url} name={m.first_name} index={m.index} size={42} />
                </View>
                <T v="small" style={{ color: on ? HT.color.brand : HT.color.muted }}>{m.you ? 'You' : m.first_name}</T>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const categoryChips = CATEGORIES.map((c) => (
    <Pressable key={c.key} accessibilityRole="radio" accessibilityLabel={c.label} accessibilityState={{ checked: category === c.key }} onPress={() => setCategory(c.key)} style={chip(category === c.key)}>
      <T v="strong" style={{ fontSize: 13, color: chipText(category === c.key) }}>{c.label}</T>
    </Pressable>
  ));
  // One swipeable row on phones (two wrapped rows pushed the rest under the keypad).
  const categories = wide ? (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{categoryChips}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" style={{ marginHorizontal: -20, flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>{categoryChips}</ScrollView>
  );

  const urgencyRow = payer === me.id && !multi ? (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {(['tab', 'soon'] as const).map((u) => (
        <Pressable key={u} accessibilityRole="radio" accessibilityLabel={u === 'tab' ? 'Add to tab' : 'Pay me back soon'} accessibilityState={{ checked: urgency === u }} onPress={() => setUrgency(u)} style={chip(urgency === u)}>
          <T v="strong" style={{ fontSize: 13, color: chipText(urgency === u) }}>{u === 'tab' ? 'Add to tab' : 'Pay me back soon'}</T>
        </Pressable>
      ))}
    </View>
  ) : null;

  const splitPanel = (
    <View style={{ backgroundColor: HT.color.surface, borderRadius: HT.radius.card, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 4 }}>
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityLabel={k === 'percent' ? 'Percentage' : k === 'exact' ? 'Exact amounts' : KIND_LABEL[k]}
            accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === k ? HT.color.surface : 'transparent' }}>
            <T v="strong" style={{ fontSize: 13.5, color: kind === k ? HT.color.ink : HT.color.muted }}>{KIND_LABEL[k]}</T>
          </Pressable>
        ))}
      </View>
      {members.map((m) => {
        const on = ids.includes(m.id);
        return (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Include ${m.you ? 'you' : m.first_name}`}
              onPress={() => toggle(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, opacity: on ? 1 : 0.45 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: on ? 0 : 1.5, borderColor: HT.color.chipBorder,
                backgroundColor: on ? HT.color.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <CheckIcon size={15} color="#FFFFFF" /> : null}
              </View>
              <Avatar photo={m.photo_url} name={m.first_name} index={m.index} size={32} />
              <T v="strong">{m.you ? 'You' : m.first_name}</T>
            </Pressable>
            {kind !== 'equal' && on ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {kind === 'exact' ? <T v="muted">$</T> : null}
                <TextInput keyboardAppearance={HT.scheme} value={inputs[m.id] ?? ''} onChangeText={(t) => setInputs((cur) => ({ ...cur, [m.id]: kind === 'exact' ? centsFirst(t) : t }))}
                  keyboardType={kind === 'exact' ? 'number-pad' : 'decimal-pad'} placeholder={kind === 'shares' ? '1' : '0'} placeholderTextColor={HT.color.faint}
                  accessibilityLabel={`${m.you ? 'Your' : `${m.first_name}'s`} ${kind === 'percent' ? 'percentage' : kind === 'exact' ? 'amount' : 'shares'}`}
                  style={{ width: 92, height: 48, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 10,
                    textAlign: 'right', fontFamily: HT.font.mono, fontSize: 16, color: HT.color.ink }} />
                {kind === 'percent' ? <T v="muted">%</T> : null}
              </View>
            ) : kind === 'equal' && on && cents > 0 ? (
              <Text style={{ fontFamily: HT.font.mono, fontSize: 14, color: HT.color.muted }}>{formatCents(equalSplit(cents, payer, ids)[m.id] ?? 0)}</Text>
            ) : null}
          </View>
        );
      })}
      {splitIssue && cents > 0 ? <T v="small" style={{ color: HT.color.youOwe }}>{splitIssue}</T> : null}
    </View>
  );

  const actions = (
    <View style={{ gap: 6 }}>
      <ErrorNote message={error} />
      <Button kind="accent" title={label} onPress={save} loading={busy} disabled={cents <= 0 || !!splitIssue} />
      <Button kind="link" title={showSplit ? 'Done splitting' : 'Split differently'} onPress={() => setShowSplit((s) => !s)} />
    </View>
  );

  const keypad = <Keypad onKey={(k) => setAmount((v) => applyKey(v, k))} onClear={() => setAmount('')} compact={!wide} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1, width: '100%', maxWidth: wide ? 1000 : HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: wide ? 32 : 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingBottom: 6 }}>
          <RoundButton label="Close" onPress={() => goBack((hid ? `/group/${hid}` : '/home') as Href)}><CloseIcon size={20} /></RoundButton>
          <T v="hero" accessibilityRole="header" style={{ flex: 1, fontSize: 30, lineHeight: 36 }} numberOfLines={1} adjustsFontSizeToFit>
            {editing ? 'Edit expense' : home.kind === 'group' ? `Add to ${home.name}` : 'Add expense'}
          </T>
          {!editing ? (
            <Pressable accessibilityRole="button" accessibilityLabel={photoUri ? 'Retake receipt photo' : 'Scan a receipt'} onPress={() => scan('camera')}
              onLongPress={() => scan('library')} accessibilityHint="Hold to pick a photo instead" hitSlop={4}
              style={({ pressed }) => ({ height: 46, paddingHorizontal: photoUri ? 14 : 0, width: photoUri ? undefined : 46, borderRadius: 23, flexDirection: 'row', gap: 6,
                alignItems: 'center', justifyContent: 'center', backgroundColor: photoUri ? HT.color.ink : HT.color.surface, borderWidth: 1,
                borderColor: photoUri ? HT.color.ink : HT.color.hairline, opacity: pressed ? 0.7 : 1 })}>
              {photoUri ? <CheckIcon size={16} color={HT.color.ground} /> : <CameraIcon size={20} color={HT.color.ink} />}
              {photoUri ? <T v="strong" style={{ fontSize: 13, color: HT.color.ground }}>Receipt</T> : null}
            </Pressable>
          ) : null}
        </View>

        {wide ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: 32, paddingBottom: 16 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, paddingBottom: 16, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
              {amountBlock}
              {whoPaid}
              {categories}
              {urgencyRow}
              {showSplit ? splitPanel : null}
            </ScrollView>
            <View style={{ width: 380, justifyContent: 'center', gap: 14 }}>
              {keypad}
              {actions}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, paddingBottom: 8 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              {amountBlock}
              {whoPaid}
              {showSplit ? splitPanel : categories}
              {showSplit ? null : urgencyRow}
            </ScrollView>
            <View style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: HT.color.hairline }}>
              {showSplit ? null : keypad}
              {actions}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function NoTabToAdd() {
  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 16 }}>
        <IconButton label="Back" onPress={() => goBack('/groups' as Href)}><BackIcon /></IconButton>
        <T v="title">Add it to a tab</T>
        <T v="muted">You don't have a home set up. Open a friend or group in Friends and add the expense there.</T>
        <Button title="Go to Friends" onPress={() => router.replace('/groups' as Href)} />
      </View>
    </Screen>
  );
}
