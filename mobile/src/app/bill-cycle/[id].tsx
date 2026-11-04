import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { shortDate } from '@/components/expense-row';
import { CloseIcon } from '@/components/icons';
import { applyKey, Keypad } from '@/components/keypad';
import { Button, ErrorNote, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { api, ApiError, type BillCycle } from '@/lib/api';
import { formatCents, parseCents } from '@/lib/money';
import { toast } from '@/lib/toast';

/** One month of a bill: enter the amount, change it for this month only, or skip it. */
export default function BillCycleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { home } = useHousehold();
  const [c, setC] = useState<BillCycle | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ data: BillCycle }>(`/v1/bill_cycles/${id}`).then((r) => setC(r.data)).catch(() => setError("Couldn't load this bill.")); }, [id]);

  const cents = parseCents(amount) ?? 0;
  const people = (home?.members ?? []).filter((m) => !m.former).length || 1;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try { await fn(); router.back(); toast.show({ text: done }); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }

  if (!c) return <Screen><ErrorNote message={error} /></Screen>;
  const variableWaiting = c.kind === 'variable' && c.status !== 'posted' && c.status !== 'skipped';
  const done = c.status === 'posted' || c.status === 'skipped';

  return (
    <Screen maxWidth={HT.maxWidth.form} scroll={false}>
      <View style={{ flex: 1, gap: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Close" onPress={() => router.back()}><CloseIcon /></IconButton>
          <T v="heading" accessibilityRole="header">{c.name} · {shortDate(c.due_on)}</T>
          <View style={{ width: 44 }} />
        </View>
        {done ? (
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 40 }}>
            <T v="title">{c.status === 'posted' ? 'Posted' : 'Skipped this month'}</T>
            {c.amount_cents ? <Money cents={c.amount_cents} size={40} /> : null}
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 4, paddingTop: 8 }}>
              <Money cents={cents || c.amount_cents || 0} size={52} color={cents ? HT.color.ink : HT.color.faint} />
              <T v="muted">
                {variableWaiting ? (c.hint_cents ? `Last time: ${formatCents(c.hint_cents)}` : 'Type the amount on the bill')
                  : cents ? `This month only · normally ${formatCents(c.hint_cents ?? 0)}` : 'Change the amount for this month only'}
              </T>
              {cents ? <T v="small">{formatCents(Math.floor(cents / people))} each</T> : null}
            </View>
            <View style={{ flex: 1 }} />
            <Keypad onKey={(k) => setAmount((v) => applyKey(v, k))} onClear={() => setAmount('')} />
            <ErrorNote message={error} />
            {variableWaiting ? (
              <Button title={cents ? `Post ${formatCents(cents)}` : 'Enter the amount'} disabled={!cents} loading={busy}
                onPress={() => run(() => api(`/v1/bill_cycles/${id}/amount`, { body: { amount_cents: cents } }), `${c.name} posted. Everyone sees their share.`)} />
            ) : (
              <Button title={cents ? `Use ${formatCents(cents)} this month` : 'Enter a new amount'} disabled={!cents} loading={busy}
                onPress={() => run(() => api(`/v1/bill_cycles/${id}`, { method: 'PATCH', body: { amount_override_cents: cents } }), `${c.name} is ${formatCents(cents)} this month only`)} />
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {c.overridden ? <Button title="Back to normal" kind="secondary" style={{ flex: 1 }} onPress={() => run(() => api(`/v1/bill_cycles/${id}`, { method: 'PATCH', body: { amount_override_cents: null } }), 'Back to the usual amount')} /> : null}
              <Button title="Skip this month" kind="secondary" style={{ flex: 1 }} onPress={() => run(() => api(`/v1/bill_cycles/${id}/skip`, { body: {} }), `${c.name} skipped for ${shortDate(c.due_on)}`)} />
            </View>
            <Button title="Edit the bill" kind="link" onPress={() => router.push(`/bill-edit?id=${c.bill_id}` as Href)} />
          </>
        )}
      </View>
    </Screen>
  );
}
