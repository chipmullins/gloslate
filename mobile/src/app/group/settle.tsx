import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { ConfirmPayments } from '@/components/confirm-payments';
import { BackIcon, CheckIcon, CopyIcon, SendIcon } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, Field, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { api, ApiError, type Balance, type PayInfo, type Payment } from '@/lib/api';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { celebrateIfSettled } from '@/lib/celebrate';
import { toast } from '@/lib/toast';
import { sendRequest } from '@/app/(tabs)/home';
import { TonePicker, type ToneKey } from '@/components/tone-picker';
import { LoadState } from '@/components/load-state';
import { goBack } from '@/lib/nav';

const METHODS = [
  { key: 'venmo', label: 'Venmo' }, { key: 'cashapp', label: 'Cash App' }, { key: 'zelle', label: 'Zelle' }, { key: 'cash', label: 'Cash' }, { key: 'other', label: 'Other' },
];
const twoDp = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;

/** One payment from a group's settle-up plan: pay it, request it, or record it. */
export default function GroupSettle() {
  const { hid, from, to } = useLocalSearchParams<{ hid: string; from: string; to: string }>();
  const { home: group, reload, error: loadError } = useHousehold(hid);
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [tone, setTone] = useState<ToneKey | undefined>();
  const [pending, setPending] = useState<Payment[]>([]);
  const [amount, setAmount] = useState<string | null>(null); // null: what's left
  const [method, setMethod] = useState('venmo');
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const meId = group?.me.id;
  const youPay = !!meId && from === meId;
  const planCents = group?.settle_plan.find((t) => t.from_member_id === from && t.to_member_id === to)?.cents ?? 0;
  const waiting = pending.filter((p) => p.from_member_id === from && p.to_member_id === to).reduce((s, p) => s + p.amount_cents, 0);
  const left = Math.max(0, planCents - waiting);

  // Pending payments (so a second "I paid" can't double up), then pay links for what's left.
  const load = useCallback(async () => {
    if (!hid || !to) return;
    let waitingNow = 0;
    try {
      const p = await api<{ data: Payment[] }>(`/v1/households/${hid}/payments?status=pending`);
      setPending(p.data);
      waitingNow = p.data.filter((x) => x.from_member_id === from && x.to_member_id === to).reduce((sum, x) => sum + x.amount_cents, 0);
    } catch { /* the plan still shows */ }
    if (!youPay || planCents - waitingNow <= 0) return;
    try {
      const r = await api<{ data: PayInfo }>(`/v1/households/${hid}/pay/${to}?amount_cents=${planCents - waitingNow}`);
      setPay(r.data);
      setMethod((m) => (m === 'venmo' && !r.data.links.venmo ? (r.data.links.cashapp ? 'cashapp' : r.data.links.zelle ? 'zelle' : 'cash') : m));
    } catch { setPay(null); }
  }, [hid, from, to, youPay, planCents]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = amount ?? (left > 0 ? twoDp(left) : '');
  const cents = parseCents(shown) ?? 0;

  if (!group && !error && !loadError) return <FullScreenLoader />;
  if (!group || !from || !to) return <LoadState error={error ?? loadError ?? "Couldn't find this payment."} back="/groups" />;
  const nameOf = (mid: string) => (mid === meId ? 'You' : group.members.find((m) => m.id === mid)?.first_name ?? 'Former member');
  const other = youPay ? to : from;
  const otherName = nameOf(other);
  const oneOnOne = group.members.filter((m) => !m.former).length === 2;
  const otherIndex = Math.max(0, group.members.findIndex((m) => m.id === other));

  async function record(receiverRecorded: boolean) {
    if (!cents || cents <= 0) return setError('Enter the amount');
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data?: { id: string }; balance?: Balance }>(`/v1/households/${hid}/payments`, {
        body: receiverRecorded
          ? { from_member_id: from, to_member_id: to, amount_cents: cents, method }
          : { to_member_id: to, amount_cents: cents, method },
      });
      const played = receiverRecorded && celebrateIfSettled({ balance: res.balance, otherId: from, otherName, amountCents: cents, key: res.data?.id });
      if (!played) toast.show({ text: receiverRecorded ? `Recorded ${formatCents(cents)} from ${otherName}` : `Marked as paid. ${otherName} will confirm.` });
      await reload();
      goBack(`/group/${hid}` as Href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function openApp(kind: 'venmo' | 'cashapp') {
    const info = cents === pay?.amount_cents ? pay : (await api<{ data: PayInfo }>(`/v1/households/${hid}/pay/${to}?amount_cents=${cents}`)).data;
    const link = info?.links[kind];
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
    toast.show({ text: `Copied. Send ${formatCents(cents)} in your bank app.` });
  }

  const methodChips = (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {METHODS.map((m) => (
        <Pressable key={m.key} accessibilityRole="radio" accessibilityLabel={m.label} accessibilityState={{ checked: method === m.key }} onPress={() => setMethod(m.key)}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', borderWidth: method === m.key ? 1.5 : 1,
            borderColor: method === m.key ? HT.color.brand : HT.color.chipBorder, backgroundColor: method === m.key ? HT.color.brandTint : HT.color.surface }}>
          <T v="strong" style={{ fontSize: 13, color: method === m.key ? HT.color.brand : HT.color.ink }}>{m.label}</T>
        </Pressable>
      ))}
    </View>
  );

  const headline = youPay ? `You pay ${otherName}` : `${otherName} pays you`;

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }}>
        <IconButton label="Back" onPress={() => goBack(`/group/${hid}` as Href)}><BackIcon /></IconButton>
        <T v="heading" style={{ fontSize: 16 }} numberOfLines={1}>{group.name}</T>
      </View>
      <View style={{ gap: 16 }}>
        <Card dark style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Avatar name={otherName} index={otherIndex} />
          <T v="strong" style={{ color: HT.color.darkCardMuted }}>{planCents === 0 ? `You and ${otherName} are settled` : headline}</T>
          <Money cents={planCents} size={46} color={youPay ? HT.color.onDarkOwe : HT.color.onDarkOwed} />
          {waiting > 0 ? <T v="small" style={{ color: HT.color.darkCardMuted }}>{formatCents(waiting)} marked paid, waiting to be confirmed</T> : null}
        </Card>

        {!youPay ? (
          <ConfirmPayments payments={pending.filter((p) => p.from_member_id === from && p.to_member_id === to)} nameOf={nameOf} oneOnOne={oneOnOne}
            onDone={() => { reload(); load(); }} />
        ) : null}

        {youPay && planCents > 0 && left === 0 ? (
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <CheckIcon size={20} color={HT.color.owedToYou} />
              <T v="strong" style={{ flex: 1 }}>You marked {formatCents(waiting)} paid. Waiting on {otherName} to confirm.</T>
            </View>
          </Card>
        ) : null}

        {left > 0 && youPay ? (
          <Card style={{ gap: 12 }}>
            <Field label="Amount" value={shown} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad"
              hint={cents < left ? 'Partial payment' : undefined} />
            {pay?.links.venmo ? <Button title="Pay with Venmo" onPress={() => openApp('venmo')} /> : null}
            {pay?.links.cashapp ? <Button title="Pay with Cash App" kind={pay.links.venmo ? 'secondary' : 'primary'} onPress={() => openApp('cashapp')} /> : null}
            {pay?.links.zelle ? <Button title={`Zelle: copy ${pay.links.zelle.copy}`} kind="secondary" icon={<CopyIcon size={18} />} onPress={copyZelle} /> : null}
            {pay && !pay.links.venmo && !pay.links.cashapp && !pay.links.zelle ? <T v="muted">{otherName} hasn't added a payment app. Pay however you usually do, then tap I paid.</T> : null}
            <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
            {opened ? <T v="strong">Sent it? Let {otherName} know.</T> : null}
            {methodChips}
            <Button title="I paid" icon={<CheckIcon size={18} color="#FFFFFF" />} onPress={() => record(false)} loading={busy} disabled={!cents || cents > left} />
            {cents > left ? <T v="small" style={{ color: HT.color.youOwe }}>That's more than the {formatCents(left)} left.</T> : null}
          </Card>
        ) : null}

        {left > 0 && !youPay ? (
          <Card style={{ gap: 12 }}>
            <TonePicker value={tone} onChange={setTone} preview="share" />
            <Button title={`Request ${formatCents(left)}`} icon={<SendIcon size={18} color="#FFFFFF" />}
              onPress={() => sendRequest(hid, from, undefined, tone).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't send it."))} />
            <T v="small">Sends {otherName} a link with the amount and how to pay you. They don't need the app.</T>
            <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
            <T v="strong">{otherName} already paid you?</T>
            <Field label="Amount" value={shown} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad" />
            {methodChips}
            <Button kind="secondary" title={`Record ${formatCents(cents)} from ${otherName}`} icon={<CheckIcon size={18} color={HT.color.ink} />}
              onPress={() => record(true)} loading={busy} disabled={!cents || cents > left} />
          </Card>
        ) : null}

        <ErrorNote message={error} />
        <Button kind="link" title="See everything in this group" onPress={() => router.replace(`/group/${hid}` as Href)} />
      </View>
    </Screen>
  );
}
