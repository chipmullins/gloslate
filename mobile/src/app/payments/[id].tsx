import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { BackIcon } from '@/components/icons';
import { Button, Card, ErrorNote, Field, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { api, ApiError, type Balance, type Payment } from '@/lib/api';
import { celebrateIfSettled } from '@/lib/celebrate';
import { toast } from '@/lib/toast';
import { goBack } from '@/lib/nav';

const METHOD = { venmo: 'Venmo', cashapp: 'Cash App', zelle: 'Zelle', cash: 'Cash', other: 'Other', forgiven: 'Forgiven' } as Record<string, string>;

/** Confirm, question, or talk about one payment. */
export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<Payment | null>(null);
  const { home } = useHousehold(p?.household_id); // a group's payment shows the group's people
  const [note, setNote] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ data: Payment }>(`/v1/payments/${id}`).then((r) => setP(r.data)).catch(() => setError("Couldn't load this payment."));
  }, [id]);
  useEffect(load, [load]);

  const name = (mid: string | null) => {
    const m = home?.members.find((x) => x.id === mid);
    return m ? (m.you ? 'You' : m.first_name) : 'Gloslate';
  };

  async function act(path: string, body: object = {}, done?: string) {
    setError(null);
    try {
      const res = await api<{ balance?: Balance }>(`/v1/payments/${id}/${path}`, { body });
      const from = home?.members.find((m) => m.id === p?.from_member_id);
      const played = path === 'confirm' && celebrateIfSettled({ balance: res.balance, otherId: from?.id, otherName: from?.first_name, amountCents: p?.amount_cents, key: id });
      if (!played && done) toast.show({ text: done });
      setNote('');
      setDisputing(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }

  if (!p && !error) return <FullScreenLoader />;
  if (!p) return <Screen><ErrorNote message={error} /></Screen>;
  const status = p.status === 'pending' ? `Pending · waiting on ${p.you_received ? 'you' : name(p.to_member_id)}` : p.status === 'disputed' ? 'Questioned · back to owed' : p.auto_confirmed ? 'Confirmed automatically after 3 days' : `Confirmed by ${name(p.to_member_id)}`;

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => goBack()}><BackIcon /></IconButton>
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 26 }}>
          <T v="muted">{name(p.from_member_id)} paid {name(p.to_member_id) === 'You' ? 'you' : name(p.to_member_id)} · {METHOD[p.method] ?? p.method}</T>
          <Money cents={p.amount_cents} size={44} />
          <View style={{ backgroundColor: p.status === 'disputed' ? HT.color.warnTint : p.status === 'pending' ? HT.color.segment : HT.color.brandTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
            <T v="strong" style={{ fontSize: 13.5, color: p.status === 'disputed' ? HT.color.youOwe : p.status === 'pending' ? HT.color.ink : HT.color.brand }}>{status}</T>
          </View>
          <T v="small" style={{ textAlign: 'center' }}>Marked by a person. Gloslate never sees or moves the money.</T>
        </Card>
        <ErrorNote message={error} />
        {p.can_confirm ? <Button title="Yes, I got it" onPress={() => act('confirm', {}, 'Confirmed')} /> : null}
        {p.can_dispute && !disputing ? <Button title={p.status === 'pending' ? "I didn't get this" : 'Something is wrong'} kind="secondary" onPress={() => setDisputing(true)} /> : null}
        {disputing ? (
          <Card style={{ gap: 12 }}>
            <Field label="What happened?" value={note} onChangeText={setNote} placeholder="Only $500 came through" autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" kind="secondary" onPress={() => setDisputing(false)} style={{ flex: 1 }} />
              <Button title="Send" onPress={() => act('dispute', { note }, 'Sent. It goes back to owed.')} style={{ flex: 1 }} disabled={note.trim().length < 3} />
            </View>
          </Card>
        ) : null}
        {p.thread && p.thread.length > 0 ? (
          <View style={{ gap: 8 }}>
            <T v="heading">Notes</T>
            <Card style={{ gap: 12 }}>
              {p.thread.map((t, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <T v="body"><T v="strong">{name(t.actor_member_id)}</T> {{ 'payment.marked': 'marked it paid', 'payment.recorded': 'recorded it', 'payment.confirmed': 'confirmed', 'payment.disputed': 'questioned it', 'payment.note': 'wrote' }[t.kind] ?? t.kind}{t.note ? `: "${t.note}"` : ''}</T>
                  <T v="small">{new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</T>
                </View>
              ))}
              {p.status === 'disputed' ? (
                <View style={{ gap: 8 }}>
                  <Field label="Reply" value={note} onChangeText={setNote} placeholder="Write a note" />
                  <Button title="Send note" kind="secondary" onPress={() => act('note', { note })} disabled={!note.trim()} />
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
