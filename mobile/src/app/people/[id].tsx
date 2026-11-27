import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { BackIcon, CheckIcon, SendIcon } from '@/components/icons';
import { RoundButton, StatCard } from '@/components/stat-card';
import { Button, Card, ErrorNote, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type PersonNet } from '@/lib/api';
import { useLive } from '@/lib/live';
import { formatCents } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { celebrate } from '@/lib/celebrate';
import { toast } from '@/lib/toast';

const METHODS = [
  { key: 'venmo', label: 'Venmo' }, { key: 'cashapp', label: 'Cash App' }, { key: 'zelle', label: 'Zelle' }, { key: 'cash', label: 'Cash' }, { key: 'other', label: 'Other' },
];

/** One person, every tab you share: the single amount that squares all of them, and how it nets out. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh, user } = useSession();
  const [p, setP] = useState<PersonNet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'request' | 'settle' | null>(null);
  const [method, setMethod] = useState('venmo');
  const [picking, setPicking] = useState(false);

  const load = useCallback(() => {
    api<{ data: PersonNet }>(`/v1/people/${id}`).then((r) => { setP(r.data); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load this person."));
  }, [id]);
  useFocusEffect(load);
  useLive(load);

  if (!p) return error ? (
    <Screen>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => goBack('/groups' as Href)}><BackIcon /></IconButton>
        <ErrorNote message={error} />
        <Button title="Try again" kind="secondary" onPress={load} />
      </View>
    </Screen>
  ) : <FullScreenLoader />;
  const net = p.net_cents;
  const theyOwe = net > 0;
  const open = p.tabs.filter((t) => t.cents !== 0);
  const name = p.first_name;

  async function request() {
    setBusy('request');
    try {
      await api(`/v1/people/${id}/request`, { body: {} });
      toast.show({ text: `Sent. ${name} gets a request for ${formatCents(net)} in Gloslate.` });
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't send it." });
    } finally { setBusy(null); }
  }

  async function settle() {
    setBusy('settle');
    try {
      const r = await api<{ data: PersonNet; payments: number }>(`/v1/people/${id}/settle`, { body: { method } });
      setP(r.data);
      setPicking(false);
      refresh().catch(() => {});
      if (theyOwe && r.data.net_cents === 0) {
        celebrate.show({ title: `Clean slate with ${name}.`, body: `${name}'s ${formatCents(net)} is recorded. Nothing owed either way.`, amountCents: net });
        return;
      }
      toast.show({ text: theyOwe
        ? `Recorded. ${name}'s ${formatCents(net)} squares ${r.payments === 1 ? 'your tab' : `all ${r.payments} tabs`}.`
        : `Marked ${formatCents(-net)} paid. ${name} confirms it, then ${r.payments === 1 ? 'your tab is' : 'every tab is'} square.` });
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't record it." });
    } finally { setBusy(null); }
  }

  const full = `${name}${p.last_initial ? ` ${p.last_initial}.` : ''}`;
  const biggest = Math.max(1, ...p.tabs.map((t) => Math.abs(t.cents)));
  const tabWord = `${p.tab_count} ${p.tab_count === 1 ? 'tab' : 'tabs'}`;
  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton label="Back" onPress={() => goBack('/groups' as Href)}><BackIcon size={20} /></RoundButton>
          <T accessibilityRole="header" style={{ fontFamily: HT.font.semibold, fontSize: 15, color: HT.color.muted }}>{full}</T>
          <View style={{ width: 46 }} />
        </View>

        <StatCard net={net} name={name} sub={`${tabWord} together`} me={user ? { name: user.first_name, photo: user.photo_url } : undefined}
          them={{ name, photo: p.photo_url }} note={net === 0 ? `Square across ${p.tab_count === 1 ? 'your tab' : `all ${tabWord}`}` : open.length > 1 ? 'Netted, both ways' : undefined} />

        <Card style={{ gap: 14, paddingVertical: 18 }}>
          <View style={{ gap: 2 }}>
            <T accessibilityRole="header" style={{ fontFamily: HT.font.displayExtra, fontSize: 19 }}>How it nets out</T>
            {open.length > 1 && net !== 0 ? <T v="small" style={{ fontSize: 13 }}>One payment settles {open.length === p.tab_count ? 'every tab' : `${open.length} tabs`}</T> : null}
          </View>
          {p.tabs.map((t) => {
            const color = t.cents > 0 ? HT.color.owedToYou : t.cents < 0 ? HT.color.youOwe : HT.color.muted;
            return (
              <Pressable key={t.household_id} accessibilityRole="button" accessibilityLabel={`${t.name}. ${t.cents > 0 ? `${name} owes you` : t.cents < 0 ? `You owe ${name}` : 'Square'} ${t.cents ? formatCents(Math.abs(t.cents)) : ''}`}
                onPress={() => router.push((t.kind === 'group' ? `/group/${t.household_id}` : '/home') as Href)}
                style={({ pressed }) => ({ gap: 8, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <T v="strong" numberOfLines={1} style={{ flex: 1, fontSize: 15.5 }}>{t.name}<T v="small" style={{ fontSize: 13.5, fontFamily: HT.font.medium }}>  · {t.kind === 'group' ? 'group' : 'your home'}</T></T>
                  <T style={{ fontFamily: HT.font.monoBold, fontSize: 15.5, color, fontVariant: ['tabular-nums'] }}>
                    {t.cents === 0 ? '$0.00' : `${t.cents > 0 ? '+' : '−'}${formatCents(Math.abs(t.cents))}`}
                  </T>
                </View>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 8, borderRadius: 4, backgroundColor: HT.color.segment, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round((Math.abs(t.cents) / biggest) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
                </View>
              </Pressable>
            );
          })}
          {p.tabs.length > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: HT.color.hairline }}>
              <T v="strong" style={{ flex: 1 }}>Net</T>
              <T style={{ fontFamily: HT.font.monoBold, fontSize: 17, color: net > 0 ? HT.color.owedToYou : net < 0 ? HT.color.youOwe : HT.color.muted, fontVariant: ['tabular-nums'] }}>
                {net === 0 ? '$0.00' : `${net > 0 ? '+' : '−'}${formatCents(Math.abs(net))}`}
              </T>
            </View>
          ) : null}
        </Card>

        {net !== 0 ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {theyOwe ? (
              <>
                <Button kind="accent" title={`Request ${formatCents(net)}`} icon={<SendIcon size={18} color={HT.color.onAccent} />} loading={busy === 'request'} onPress={request}
                  style={{ flex: 1, minHeight: 58, borderRadius: 18 }} />
                <Button kind="secondary" title="Paid me" accessibilityLabel={`${name} paid me ${formatCents(net)}`} onPress={() => setPicking(true)}
                  style={{ minHeight: 58, borderRadius: 18, borderColor: HT.color.hairline }} />
              </>
            ) : (
              <Button kind="accent" title={`I paid ${formatCents(-net)}`} icon={<CheckIcon size={18} color={HT.color.onAccent} />} onPress={() => setPicking(true)}
                style={{ flex: 1, minHeight: 58, borderRadius: 18 }} />
            )}
          </View>
        ) : null}

        {p.to_confirm_cents ? (
          <Card style={{ gap: 10 }}>
            <T v="strong">{name} marked {formatCents(p.to_confirm_cents)} paid</T>
            <T v="small">Confirm it once it shows up in your {p.tabs.find((t) => t.to_confirm_cents)?.kind === 'group' ? 'tab' : 'home'}. It's already counted above.</T>
            <Button title="Review" kind="secondary" onPress={() => {
              const t = p.tabs.find((x) => x.to_confirm_cents);
              router.push((t && t.kind === 'group' ? `/group/${t.household_id}` : '/home') as Href);
            }} />
          </Card>
        ) : null}
        {p.waiting_cents ? (
          <T v="small" style={{ textAlign: 'center' }}>You marked {formatCents(p.waiting_cents)} paid. Waiting on {name} to confirm.</T>
        ) : null}

        {picking ? (
          <Card style={{ gap: 12 }}>
            <T v="strong">How was it paid?</T>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {METHODS.map((m) => (
                <Pressable key={m.key} accessibilityRole="radio" accessibilityState={{ checked: method === m.key }} onPress={() => setMethod(m.key)}
                  style={{ minHeight: 40, paddingHorizontal: 15, borderRadius: 20, justifyContent: 'center', borderWidth: 1,
                    borderColor: method === m.key ? HT.color.ink : HT.color.chipBorder, backgroundColor: method === m.key ? HT.color.ink : HT.color.surface }}>
                  <T v="strong" style={{ fontSize: 13.5, color: method === m.key ? HT.color.ground : HT.color.ink }}>{m.label}</T>
                </Pressable>
              ))}
            </View>
            <T v="small">{theyOwe
              ? `Gloslate records it in each tab. Any part you owed ${name} waits for ${name} to confirm.`
              : `Gloslate records it in each tab. ${name} confirms it arrived, like any payment.`}</T>
            <Button kind="accent" title={theyOwe ? 'Record it' : `Mark ${formatCents(-net)} paid`} loading={busy === 'settle'} onPress={settle} />
          </Card>
        ) : null}

        <T v="small">Each tab keeps its own history, so everyone else in a home or group still sees their own numbers.</T>
      </View>
    </Screen>
  );
}
