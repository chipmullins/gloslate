import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { shortDate } from '@/components/expense-row';
import { BackIcon, DownloadIcon } from '@/components/icons';
import { Button, Card, ErrorNote, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, type Statement } from '@/lib/api';
import { downloadAndShare } from '@/lib/files';
import { formatCents } from '@/lib/money';

/** A frozen monthly statement. Your view by default; the whole house one tap away. */
export default function StatementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wide } = useLayout();
  const [s, setS] = useState<Statement | null>(null);
  const [everyone, setEveryone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ data: Statement }>(`/v1/statements/${id}`).then((r) => setS(r.data)).catch(() => setError("Couldn't load this statement.")); }, [id]);
  if (!s) return <Screen><ErrorNote message={error} /></Screen>;

  const d = s.data;
  const me = s.you;
  const name = (mid: string) => (mid === me ? 'You' : d.names[mid] ?? 'Former member');
  const expenses = everyone ? d.expenses : d.expenses.filter((e) => e.payer_id === me || (e.shares[me] ?? 0) > 0);
  const transfers = everyone ? d.transfers : d.transfers.filter((t) => t.from === me || t.to === me);

  const header = (
    <Card dark style={{ gap: 6, alignItems: 'center', paddingVertical: 24 }}>
      <T v="strong" style={{ color: HT.color.darkCardMuted }}>{s.title}</T>
      <T v="title" style={{ color: '#fff', textAlign: 'center' }}>{s.summary}</T>
      <T v="small" style={{ color: HT.color.darkCardMuted }}>{shortDate(s.period_start)} – {shortDate(s.period_end)} · frozen record</T>
    </Card>
  );

  const toggle = (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 6 }}>
      {[false, true].map((all) => (
        <Pressable key={String(all)} accessibilityRole="radio" accessibilityState={{ checked: everyone === all }} onPress={() => setEveryone(all)}
          style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: everyone === all ? HT.color.surface : 'transparent' }}>
          <T v="strong" style={{ color: everyone === all ? HT.color.ink : HT.color.muted }}>{all ? 'Whole house' : 'Your view'}</T>
        </Pressable>
      ))}
    </View>
  );

  const totals = (
    <Card style={{ gap: 10 }}>
      <Row label="Spent together" cents={d.totals.spent_cents} />
      {everyone
        ? Object.entries(d.totals.paid_by).map(([mid, c]) => <Row key={mid} label={`${name(mid)} paid`} cents={c} />)
        : <><Row label="You paid" cents={d.totals.paid_by[me] ?? 0} /><Row label="Your share" cents={d.totals.share_of[me] ?? 0} /></>}
      <Row label="Settled during the month" cents={d.totals.settled_cents} />
      <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
      <T v="heading">To clear what's left</T>
      {transfers.length === 0 ? <T v="muted">Nothing. Everyone's even.</T> : transfers.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="strong">{name(t.from)} → {name(t.to)}</T><Money cents={t.cents} />
        </View>
      ))}
    </Card>
  );

  const list = (
    <View style={{ gap: 8 }}>
      <T v="heading">Items</T>
      <Card style={{ paddingVertical: 4 }}>
        {expenses.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Nothing this month</T> : null}
        {expenses.map((e, i) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: 12, borderBottomWidth: i < expenses.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <View style={{ flex: 1 }}>
              <T v="strong" numberOfLines={1}>{e.description}</T>
              <T v="small">{shortDate(String(e.spent_on))} · {name(e.payer_id)} paid{everyone ? '' : e.shares[me] ? ` · your share ${formatCents(e.shares[me])}` : ''}</T>
            </View>
            <Money cents={e.amount_cents} />
          </View>
        ))}
      </Card>
      {d.adjustments.length > 0 ? (
        <>
          <T v="heading">Changes to earlier months</T>
          <Card style={{ gap: 8 }}>
            {d.adjustments.map((a, i) => (
              <T key={i} v="body"><T v="strong">{a.description}</T> {a.kind === 'deleted' ? 'was deleted' : a.kind === 'restored' ? 'was brought back' : `changed from ${formatCents(a.before_cents ?? 0)} to ${formatCents(a.after_cents ?? 0)}`}</T>
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );

  const exportBtn = (
    <Button title="Download PDF" kind="secondary" icon={<DownloadIcon size={18} />}
      onPress={() => downloadAndShare(`/v1/statements/${s.id}.pdf`, `HomeTab-${s.period_start.slice(0, 7)}.pdf`, 'application/pdf').catch(() => setError("Couldn't download the PDF."))} />
  );

  return (
    <Screen maxWidth={wide ? 1000 : HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => router.back()}><BackIcon /></IconButton>
        <ErrorNote message={error} />
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 18 }}>{header}{toggle}{totals}{exportBtn}</View>
            <View style={{ flex: 1, gap: 18 }}>{list}</View>
          </View>
        ) : (
          <>{header}{toggle}{totals}{list}{exportBtn}</>
        )}
      </View>
    </Screen>
  );
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="body">{label}</T><Money cents={cents} />
    </View>
  );
}
