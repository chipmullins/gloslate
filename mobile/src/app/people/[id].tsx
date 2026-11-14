import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { BackIcon, ChevronIcon } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type PersonNet } from '@/lib/api';
import { useLive } from '@/lib/live';
import { formatCents } from '@/lib/money';
import { goBack } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

const METHODS = [
  { key: 'venmo', label: 'Venmo' }, { key: 'cashapp', label: 'Cash App' }, { key: 'zelle', label: 'Zelle' }, { key: 'cash', label: 'Cash' }, { key: 'other', label: 'Other' },
];

/** One person, every tab you share: the single amount that squares all of them, and how it nets out. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useSession();
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
      toast.show({ text: theyOwe
        ? `Recorded. ${name}'s ${formatCents(net)} squares ${r.payments === 1 ? 'your tab' : `all ${r.payments} tabs`}.`
        : `Marked ${formatCents(-net)} paid. ${name} confirms it, then ${r.payments === 1 ? 'your tab is' : 'every tab is'} square.` });
    } catch (e) {
      toast.show({ text: e instanceof ApiError ? e.message : "Couldn't record it." });
    } finally { setBusy(null); }
  }

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => goBack('/groups' as Href)}><BackIcon /></IconButton>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={name} photo={p.photo_url} size={52} />
          <T v="display" accessibilityRole="header">{name}{p.last_initial ? ` ${p.last_initial}.` : ''}</T>
        </View>

        <Card dark fireflies style={{ gap: 8, paddingVertical: 22 }}>
          {net === 0 ? (
            <>
              <T v="heading" style={{ color: HT.color.onDarkText, fontSize: 22 }}>You and {name} are square</T>
              <T style={{ color: HT.color.darkCardMuted }}>Across all {p.tab_count} {p.tab_count === 1 ? 'tab' : 'tabs'} you share.</T>
            </>
          ) : (
            <>
              <T v="strong" style={{ color: HT.color.darkCardMuted, fontSize: 14 }}>{theyOwe ? `Across everything, ${name} sends you` : `Across everything, you send ${name}`}</T>
              <Money cents={Math.abs(net)} size={44} color={theyOwe ? HT.color.onDarkOwed : HT.color.onDarkOwe} />
              {open.length > 1 ? <T style={{ color: HT.color.darkCardMuted }}>One payment settles {open.length === p.tab_count ? 'every tab' : `${open.length} tabs`}.</T> : null}
              <View style={{ gap: 10, marginTop: 8 }}>
                {theyOwe ? (
                  <>
                    <Button kind="onDark" title={`Request ${formatCents(net)}`} loading={busy === 'request'} onPress={request} />
                    <Button kind="glass" title={`${name} paid me ${formatCents(net)}`} onPress={() => setPicking(true)} />
                  </>
                ) : (
                  <Button kind="onDark" title={`I paid ${formatCents(-net)}`} onPress={() => setPicking(true)} />
                )}
              </View>
            </>
          )}
        </Card>

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
                  style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: method === m.key ? 1.5 : 1,
                    borderColor: method === m.key ? HT.color.brand : HT.color.chipBorder, backgroundColor: method === m.key ? HT.color.brandTint : HT.color.surface }}>
                  <T v="strong" style={{ fontSize: 13.5, color: method === m.key ? HT.color.brand : HT.color.ink }}>{m.label}</T>
                </Pressable>
              ))}
            </View>
            <T v="small">{theyOwe
              ? `Gloslate records it in each tab. Any part you owed ${name} waits for ${name} to confirm.`
              : `Gloslate records it in each tab. ${name} confirms it arrived, like any payment.`}</T>
            <Button title={theyOwe ? 'Record it' : `Mark ${formatCents(-net)} paid`} loading={busy === 'settle'} onPress={settle} />
          </Card>
        ) : null}

        <View style={{ gap: 8 }}>
          <T v="label">How it nets out</T>
          <Card style={{ paddingVertical: 4 }}>
            {p.tabs.map((t, i) => (
              <Pressable key={t.household_id} accessibilityRole="button" accessibilityLabel={`${t.name}. ${t.cents > 0 ? `${name} owes you` : t.cents < 0 ? `You owe ${name}` : 'Square'} ${t.cents ? formatCents(Math.abs(t.cents)) : ''}`}
                onPress={() => router.push((t.kind === 'group' ? `/group/${t.household_id}` : '/home') as Href)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, opacity: pressed ? 0.7 : 1,
                  borderTopWidth: i ? 1 : 0, borderTopColor: HT.color.hairline })}>
                <View style={{ flex: 1 }}>
                  <T v="strong" numberOfLines={1}>{t.name}</T>
                  <T v="small">{t.kind === 'group' ? 'Group' : 'Your home'} · {t.cents > 0 ? `${name} owes you` : t.cents < 0 ? `you owe ${name}` : 'square'}</T>
                </View>
                <T v="strong" style={{ color: t.cents > 0 ? HT.color.owedToYou : t.cents < 0 ? HT.color.youOwe : HT.color.muted }}>
                  {t.cents === 0 ? '$0.00' : `${t.cents > 0 ? '+' : '−'}${formatCents(Math.abs(t.cents))}`}
                </T>
                <ChevronIcon size={16} color={HT.color.muted} />
              </Pressable>
            ))}
            {p.tabs.length > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderTopWidth: 1, borderTopColor: HT.color.hairline }}>
                <T v="strong" style={{ flex: 1 }}>Net</T>
                <T v="strong" style={{ color: net > 0 ? HT.color.owedToYou : net < 0 ? HT.color.youOwe : HT.color.muted, marginRight: 28 }}>
                  {net === 0 ? '$0.00' : `${net > 0 ? '+' : '−'}${formatCents(Math.abs(net))}`}
                </T>
              </View>
            ) : null}
          </Card>
          <T v="small">Each tab keeps its own history, so everyone else in a home or group still sees their own numbers.</T>
        </View>
      </View>
    </Screen>
  );
}
