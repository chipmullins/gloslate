import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { shortDate } from '@/components/expense-row';
import { BackIcon, CheckIcon, CopyIcon, PlusIcon, SendIcon } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, Field, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Breakdown, type PayInfo } from '@/lib/api';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { toast } from '@/lib/toast';
import { sendRequest } from '@/app/(tabs)/home';

const METHODS = [
  { key: 'venmo', label: 'Venmo' }, { key: 'cashapp', label: 'Cash App' }, { key: 'zelle', label: 'Zelle' }, { key: 'cash', label: 'Cash' }, { key: 'other', label: 'Other' },
];

/** What you've marked paid to this person that they haven't confirmed yet. */
function waitingFrom(b: Breakdown) {
  return b.payments.filter((p) => p.status === 'pending' && p.you_sent).reduce((s, p) => s + p.amount_cents, 0);
}

function centsToInput(c: number) {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** Everything behind one person's balance, and how to settle it. */
export default function Settle() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { home } = useHousehold();
  const { wide } = useLayout();
  const [b, setB] = useState<Breakdown | null>(null);
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('venmo');
  const [opened, setOpened] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const other = home?.members.find((m) => m.id === memberId);
  const otherIndex = Math.max(0, home?.members.findIndex((m) => m.id === memberId) ?? 0);

  const load = useCallback(async () => {
    if (!home) return;
    try {
      const r = await api<{ data: Breakdown }>(`/v1/households/${home.id}/balances/${memberId}`);
      setB(r.data);
      if (r.data.net_cents < 0) {
        const p = await api<{ data: PayInfo }>(`/v1/households/${home.id}/pay/${memberId}`);
        setPay(p.data);
        const left = -r.data.net_cents - waitingFrom(r.data);
        setAmount((a) => a || (left > 0 ? centsToInput(left) : ''));
        setMethod(p.data.links.venmo ? 'venmo' : p.data.links.cashapp ? 'cashapp' : p.data.links.zelle ? 'zelle' : 'cash');
      } else {
        setPay(null);
        setAmount((a) => a || (r.data.net_cents > 0 ? centsToInput(r.data.net_cents) : ''));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [home, memberId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const owedByMe = useMemo(() => (b?.items ?? []).filter((i) => i.cents < 0 && i.status !== 'paid'), [b]);

  function togglePick(id: string) {
    setPicked((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      const sum = owedByMe.filter((i) => next.includes(i.expense_id)).reduce((s, i) => s + (-i.cents - i.paid_cents), 0);
      if (next.length) setAmount(centsToInput(sum));
      else if (b) setAmount(centsToInput(Math.max(0, -b.net_cents)));
      return next;
    });
  }

  async function openApp(kind: 'venmo' | 'cashapp') {
    if (!pay) return;
    const cents = parseCents(amount) ?? pay.amount_cents;
    // Re-fetch links for a partial / item amount so the app opens with the right number.
    const info = cents === pay.amount_cents ? pay : (await api<{ data: PayInfo }>(`/v1/households/${home!.id}/pay/${memberId}?amount_cents=${cents}`)).data;
    const link = info.links[kind];
    if (!link) return;
    setMethod(kind);
    setOpened(true);
    const can = await Linking.canOpenURL(link.app).catch(() => false);
    await Linking.openURL(can ? link.app : link.web);
  }

  async function copyZelle() {
    if (!pay?.links.zelle) return;
    await Clipboard.setStringAsync(pay.links.zelle.copy);
    setMethod('zelle');
    setOpened(true);
    toast.show({ text: `Copied. Send ${formatCents(parseCents(amount) ?? pay.amount_cents)} in your bank app.` });
  }

  async function markPaid(receiverRecorded = false) {
    if (!home || !other) return;
    const cents = parseCents(amount);
    if (!cents) return setError('Enter the amount');
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const allocations = Object.fromEntries(owedByMe.filter((i) => picked.includes(i.expense_id)).map((i) => [i.expense_id, -i.cents - i.paid_cents]));
      await api(`/v1/households/${home.id}/payments`, {
        body: receiverRecorded
          ? { from_member_id: other.id, to_member_id: home.me.id, amount_cents: cents, method }
          : { to_member_id: other.id, amount_cents: cents, method, allocations },
      });
      toast.show({ text: receiverRecorded ? `Recorded ${formatCents(cents)} from ${other.first_name}` : `Marked as paid. ${other.first_name} will confirm.` });
      setPicked([]);
      setAmount('');
      setOpened(false);
      setRecording(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (!home || !other || !b) return <Screen><ErrorNote message={error} /></Screen>;

  const net = b.net_cents;
  const theyOwe = net > 0;
  const headline = net === 0 ? `You and ${other.first_name} are even` : theyOwe ? `${other.first_name} owes you` : `You owe ${other.first_name}`;
  const pendingPay = b.payments.find((p) => p.status === 'pending');
  const waiting = waitingFrom(b);
  const left = -net - waiting; // what's still unmarked when you owe

  const summary = (
    <Card dark style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
      <Avatar name={other.first_name} index={otherIndex} />
      <T v="strong" style={{ color: HT.color.darkCardMuted }}>{headline}</T>
      <Money cents={Math.abs(net)} size={48} color="#FFFFFF" />
      {b.credit_cents.theirs > 0 ? <T v="small" style={{ color: HT.color.onDarkOwed }}>{other.first_name} has {formatCents(b.credit_cents.theirs)} credit from overpaying</T> : null}
      {b.credit_cents.mine > 0 ? <T v="small" style={{ color: HT.color.onDarkOwed }}>You have {formatCents(b.credit_cents.mine)} credit</T> : null}
      {pendingPay ? (
        <Pressable onPress={() => router.push(`/payments/${pendingPay.id}` as Href)} style={{ marginTop: 6, backgroundColor: HT.color.onDarkButton, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
          <T v="small" style={{ color: '#FFFFFF' }}>Pending · {formatCents(pendingPay.amount_cents)} waiting on {pendingPay.you_sent ? other.first_name : 'you'} to confirm</T>
        </Pressable>
      ) : null}
    </Card>
  );

  const methodChips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {METHODS.map((m) => (
        <Pressable key={m.key} accessibilityRole="radio" accessibilityLabel={m.label} accessibilityState={{ checked: method === m.key }} onPress={() => setMethod(m.key)}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: method === m.key ? 1.5 : 1,
            borderColor: method === m.key ? HT.color.brand : HT.color.chipBorder, backgroundColor: method === m.key ? HT.color.brandTint : HT.color.surface }}>
          <T v="strong" style={{ fontSize: 13, color: method === m.key ? HT.color.brand : HT.color.ink }}>{m.label}</T>
        </Pressable>
      ))}
    </View>
  );

  const actions = theyOwe ? (
    <Card style={{ gap: 12 }}>
      <Button title={`Request ${formatCents(net)}`} icon={<SendIcon size={18} color="#fff" />}
        onPress={() => sendRequest(home.id, other.id).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't send it."))} />
      {recording ? (
        <View style={{ gap: 12 }}>
          <Field label={`How much did ${other.first_name} pay you?`} value={amount} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad" />
          {methodChips}
          <Button title={`Record ${amount ? formatCents(parseCents(amount) ?? 0) : ''} from ${other.first_name}`} onPress={() => markPaid(true)} loading={busy} />
        </View>
      ) : (
        <Button kind="secondary" title={`${other.first_name} paid me: mark it received`} icon={<CheckIcon size={18} color={HT.color.ink} />} onPress={() => setRecording(true)} />
      )}
      <T v="small">Tabitat never moves money. A payment you record counts as confirmed by you.</T>
    </Card>
  ) : net < 0 && pay && left <= 0 ? (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <CheckIcon size={20} color={HT.color.owedToYou} />
        <T v="strong" style={{ flex: 1 }}>You marked {formatCents(waiting)} paid. Waiting on {other.first_name} to confirm.</T>
      </View>
      <T v="small">It counts once {other.first_name} confirms, or on its own after 3 days.</T>
      <Button kind="secondary" title="I paid for some things too" icon={<PlusIcon size={16} />}
        accessibilityLabel={`Add things you paid for, to subtract from what you owe ${other.first_name}`}
        onPress={() => router.push(`/counter?memberId=${other.id}` as Href)} />
    </Card>
  ) : net < 0 && pay ? (
    <Card style={{ gap: 12 }}>
      {waiting > 0 ? <T v="small">{formatCents(waiting)} is already waiting on {other.first_name}. {formatCents(left)} left to mark.</T> : null}
      <Button kind="secondary" title="I paid for some things too" icon={<PlusIcon size={16} />}
        accessibilityLabel={`Add things you paid for, to subtract from what you owe ${other.first_name}`}
        onPress={() => router.push(`/counter?memberId=${other.id}` as Href)} />
      <Field label="Amount" value={amount} onChangeText={(t) => { setAmount(centsFirst(t)); setPicked([]); }} keyboardType="number-pad"
        hint={picked.length ? `For ${picked.length} item${picked.length > 1 ? 's' : ''}` : parseCents(amount) && parseCents(amount)! < -net ? 'Partial payment: applies to the oldest items first' : undefined} />
      <View style={{ gap: 8 }}>
        {pay.links.venmo ? <Button title={`Pay with Venmo`} onPress={() => openApp('venmo')} /> : null}
        {pay.links.cashapp ? <Button title="Pay with Cash App" kind={pay.links.venmo ? 'secondary' : 'primary'} onPress={() => openApp('cashapp')} /> : null}
        {pay.links.zelle ? <Button title={`Zelle: copy ${pay.links.zelle.copy}`} kind="secondary" icon={<CopyIcon size={18} />} onPress={copyZelle} /> : null}
        {!pay.links.venmo && !pay.links.cashapp && !pay.links.zelle ? <T v="muted">{other.first_name} hasn't added a payment app. Pay however you usually do, then tap I paid.</T> : null}
      </View>
      <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
      {opened ? <T v="strong">Sent it? Let {other.first_name} know.</T> : null}
      {methodChips}
      <Button title="I paid" kind={opened ? 'primary' : 'secondary'} icon={<CheckIcon size={18} color={opened ? '#fff' : HT.color.ink} />} onPress={() => markPaid(false)} loading={busy} />
    </Card>
  ) : null;

  const items = (
    <View style={{ gap: 8 }}>
      <T v="heading">What's behind it</T>
      <Card style={{ paddingVertical: 4 }}>
        {b.items.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Nothing shared yet</T> : null}
        {b.items.map((i, idx) => {
          const mine = i.cents < 0;
          const pickable = mine && i.status !== 'paid' && net < 0;
          const on = picked.includes(i.expense_id);
          const total = Math.abs(i.cents);
          return (
            <Pressable key={i.expense_id + idx} accessibilityRole={pickable ? 'checkbox' : 'button'} accessibilityState={pickable ? { checked: on } : undefined}
              onPress={() => (pickable ? togglePick(i.expense_id) : router.push(`/expense/${i.expense_id}` as Href))}
              onLongPress={() => router.push(`/expense/${i.expense_id}` as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, opacity: i.status === 'paid' ? 0.45 : 1,
                borderBottomWidth: idx < b.items.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
              {pickable ? (
                <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: on ? 0 : 1.5, borderColor: HT.color.chipBorder, backgroundColor: on ? HT.color.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <CheckIcon size={15} color="#fff" /> : null}
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <T v="strong" numberOfLines={1}>{i.description}</T>
                <T v="small">{shortDate(i.spent_on)} · {mine ? `${other.first_name} paid` : 'you paid'}{i.status === 'partial' ? ` · ${formatCents(i.paid_cents)} of ${formatCents(total)} paid` : i.status === 'paid' ? ' · paid' : ''}</T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 1 }}>
                <T v="small" style={{ color: mine ? HT.color.youOwe : HT.color.owedToYou, fontFamily: HT.font.bold, fontSize: 12 }}>{mine ? `You owe ${other.first_name}` : `${other.first_name} owes you`}</T>
                <Money cents={Math.abs(i.cents)} color={mine ? HT.color.youOwe : HT.color.owedToYou} />
              </View>
            </Pressable>
          );
        })}
      </Card>
      {net < 0 && owedByMe.length > 1 ? <T v="small">Tap items to pay just those.</T> : null}
    </View>
  );

  const history = b.payments.length > 0 ? (
    <View style={{ gap: 8 }}>
      <T v="heading">Payments</T>
      <Card style={{ paddingVertical: 4 }}>
        {b.payments.map((p, i) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/payments/${p.id}` as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: i < b.payments.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <View style={{ flex: 1 }}>
              <T v="strong">{p.you_sent ? `You paid ${other.first_name}` : `${other.first_name} paid you`}</T>
              <T v="small">{shortDate(p.marked_at.slice(0, 10))} · {p.status === 'pending' ? 'waiting to be confirmed' : p.status === 'disputed' ? 'questioned' : p.auto_confirmed ? 'confirmed automatically' : 'confirmed'}</T>
            </View>
            <Money cents={p.amount_cents} color={p.status === 'disputed' ? HT.color.youOwe : HT.color.ink} />
          </Pressable>
        ))}
      </Card>
    </View>
  ) : null;

  return (
    <Screen maxWidth={wide ? 1000 : HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => router.back()}><BackIcon /></IconButton>
        <ErrorNote message={error} />
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 18 }}>{summary}{actions}</View>
            <View style={{ flex: 1, gap: 18 }}>{items}{history}</View>
          </View>
        ) : (
          <>{summary}{actions}{items}{history}</>
        )}
      </View>
    </Screen>
  );
}
