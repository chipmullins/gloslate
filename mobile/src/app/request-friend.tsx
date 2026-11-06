import type React from 'react';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, SendIcon } from '@/components/icons';
import { Button, ErrorNote, Field, IconButton, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Household, type Member } from '@/lib/api';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { newClientId } from '@/lib/split';
import { useSession } from '@/lib/session';
import { sendRequest } from '@/app/(tabs)/home';

type Tab = { group: Household; other: Member };

/**
 * Settle up with one person: they owe you (send a request) or you owe them
 * (go pay). Each person gets one running tab (a two-person group), so the
 * next time adds to it instead of starting over.
 */
export default function SettleWithSomeone() {
  const { user, households, refresh } = useSession();
  const needsName = !user?.first_name;
  const [myName, setMyName] = useState('');
  const [friend, setFriend] = useState('');
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [theyOwe, setTheyOwe] = useState(true); // who owes whom
  const [all, setAll] = useState(true); // all of it, or half
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef(newClientId());
  const inFlight = useRef(false);
  const made = useRef<Tab | null>(null); // a tab created on an earlier try, reused on retry

  const cents = parseCents(amount) ?? 0;
  // Half: the odd cent stays with whoever paid (same rule as the server).
  const owedPart = all ? cents : Math.floor(cents / 2);
  const first = friend.trim().split(' ')[0];
  const ready = friend.trim().length > 0 && cents > 0 && (!needsName || myName.trim().length > 0);

  // An existing one-on-one tab with someone of this name, if there is one.
  async function findTab(name: string): Promise<Tab | null> {
    if (made.current && made.current.other.display_name.trim().toLowerCase() === name.toLowerCase()) return made.current;
    const pairs = households.filter((h) => h.kind === 'group' && h.member_count === 2 && (h.people ?? []).some((p) => p.toLowerCase() === name.split(' ')[0].toLowerCase()));
    for (const h of pairs) {
      const d = await api<{ data: Household }>(`/v1/households/${h.id}`).then((r) => r.data).catch(() => null);
      const other = d?.members.find((m) => !m.you && !m.former);
      if (d && other && other.display_name.trim().toLowerCase() === name.toLowerCase()) return { group: d, other };
    }
    return null;
  }

  async function go() {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (needsName) await api('/v1/me', { method: 'PATCH', body: { first_name: myName.trim() } });
      const name = friend.trim();
      let tab = await findTab(name);
      if (!tab) {
        const me = (user?.first_name || myName.trim()).split(' ')[0];
        const res = await api<{ data: Household }>('/v1/households', { body: { kind: 'group', name: `${me} & ${name.split(' ')[0]}`, roommates: [name] } });
        tab = { group: res.data, other: res.data.members.find((m) => !m.you)! };
        made.current = tab;
      }
      const { group, other } = tab;
      const me = group.me.id;
      // They owe you: you paid. You owe them: they paid.
      const payer = theyOwe ? me : other.id;
      const owes = theyOwe ? other.id : me;
      await api(`/v1/households/${group.id}/expenses`, {
        body: {
          amount_cents: cents, payer_id: payer, participant_ids: all ? [owes] : [me, other.id], split_kind: 'equal',
          description: what.trim(), category: 'other', client_id: clientId.current,
        },
      });
      await refresh();
      if (theyOwe) {
        await sendRequest(group.id, other.id);
        router.replace(`/group/${group.id}` as Href);
      } else {
        router.replace(`/group/settle?hid=${group.id}&from=${me}&to=${other.id}` as Href);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const option = (on: boolean, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress}
      style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? HT.color.surface : 'transparent' }}>
      <T v="strong" style={{ fontSize: 14, color: on ? HT.color.ink : HT.color.muted }}>{label}</T>
    </Pressable>
  );
  const segment = (children: React.ReactNode) => (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 6 }}>{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
            <IconButton label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}><CloseIcon /></IconButton>
            <T v="heading" accessibilityRole="header" style={{ fontSize: 16 }}>Settle up with someone</T>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            {needsName ? <Field label="Your first name" value={myName} onChangeText={setMyName} autoCapitalize="words" textContentType="givenName" /> : null}
            <Field label="Who is it with?" value={friend} onChangeText={setFriend} placeholder="Their name" autoCapitalize="words" maxLength={40} autoFocus={!needsName} />
            {segment(<>{option(theyOwe, 'They owe me', () => setTheyOwe(true))}{option(!theyOwe, 'I owe them', () => setTheyOwe(false))}</>)}
            <Field label={theyOwe ? 'How much did you pay?' : `How much did ${first || 'they'} pay?`} value={amount} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad" placeholder="0.00" />
            <Field label="What for? (optional)" value={what} onChangeText={setWhat} placeholder="Lunch, concert tickets…" maxLength={60} />
            <View style={{ gap: 8 }}>
              <T v="label">{theyOwe ? 'How much of it do they owe?' : 'How much of it do you owe?'}</T>
              {segment(<>{option(all, 'All of it', () => setAll(true))}{option(!all, 'Half', () => setAll(false))}</>)}
            </View>
            {cents > 0 && first ? (
              <T v="muted" style={{ textAlign: 'center' }}>
                {theyOwe ? `${first} will owe you ${formatCents(owedPart)}. You'll pick how to send the link next.` : `You'll owe ${first} ${formatCents(owedPart)}. Next you'll see how to pay them.`}
              </T>
            ) : null}
          </ScrollView>
          <View style={{ gap: 6, paddingBottom: 8 }}>
            <ErrorNote message={error} />
            <Button title={cents > 0 ? (theyOwe ? `Request ${formatCents(owedPart)}` : `Pay ${first || 'them'} ${formatCents(owedPart)}`) : 'Continue'}
              icon={theyOwe ? <SendIcon size={18} color="#FFFFFF" /> : undefined} onPress={go} loading={busy} disabled={!ready} />
            <T v="small" style={{ textAlign: 'center' }}>Gloslate never moves money. Payments happen in Venmo, Cash App or Zelle.</T>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
