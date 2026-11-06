import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, SendIcon } from '@/components/icons';
import { Button, ErrorNote, Field, IconButton, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Household } from '@/lib/api';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { newClientId } from '@/lib/split';
import { useSession } from '@/lib/session';
import { sendRequest } from '@/app/(tabs)/home';

/**
 * "You owe me": a quick request to one friend. Keeps a running tab with them
 * (a two-person group), so the next one adds to it instead of starting over.
 */
export default function RequestFriend() {
  const { user, households, refresh } = useSession();
  const needsName = !user?.first_name;
  const [myName, setMyName] = useState('');
  const [friend, setFriend] = useState('');
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [all, setAll] = useState(true); // they owe all of it, or half
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef(newClientId());

  const cents = parseCents(amount) ?? 0;
  const theirPart = all ? cents : Math.floor(cents / 2); // odd cent stays with you, the payer
  const ready = friend.trim().length > 0 && cents > 0 && (!needsName || myName.trim().length > 0);

  // An existing two-person tab with someone of this name, if there is one.
  async function findTab(name: string) {
    const pairs = households.filter((h) => h.kind === 'group' && h.member_count === 2);
    for (const h of pairs) {
      const d = await api<{ data: Household }>(`/v1/households/${h.id}`).then((r) => r.data).catch(() => null);
      const other = d?.members.find((m) => !m.you && !m.former);
      if (d && other && other.display_name.trim().toLowerCase() === name.toLowerCase()) return { group: d, other };
    }
    return null;
  }

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (needsName) await api('/v1/me', { method: 'PATCH', body: { first_name: myName.trim() } });
      const name = friend.trim();
      let tab = await findTab(name);
      if (!tab) {
        const me = (user?.first_name || myName.trim()).split(' ')[0];
        const res = await api<{ data: Household }>('/v1/households', { body: { kind: 'group', name: `${me} & ${name.split(' ')[0]}`, roommates: [name] } });
        const other = res.data.members.find((m) => !m.you)!;
        tab = { group: res.data, other };
      }
      const { group, other } = tab;
      await api(`/v1/households/${group.id}/expenses`, {
        body: {
          amount_cents: cents, payer_id: group.me.id, participant_ids: all ? [other.id] : [group.me.id, other.id], split_kind: 'equal',
          description: what.trim(), category: 'other', client_id: clientId.current,
        },
      });
      await refresh();
      await sendRequest(group.id, other.id).catch((e) => {
        // The tab is saved either way; say why the link didn't go out.
        if (e instanceof ApiError) throw e;
      });
      router.replace(`/group/${group.id}` as Href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const option = (on: boolean, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress}
      style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? HT.color.surface : 'transparent' }}>
      <T v="strong" style={{ fontSize: 14, color: on ? HT.color.ink : HT.color.muted }}>{label}</T>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
            <IconButton label="Close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}><CloseIcon /></IconButton>
            <T v="heading" accessibilityRole="header" style={{ fontSize: 16 }}>Someone owes you</T>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            {needsName ? <Field label="Your first name" value={myName} onChangeText={setMyName} autoCapitalize="words" textContentType="givenName" /> : null}
            <Field label="Who owes you?" value={friend} onChangeText={setFriend} placeholder="Their name" autoCapitalize="words" maxLength={40} autoFocus={!needsName} />
            <Field label="How much did you pay?" value={amount} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad" placeholder="0.00" />
            <Field label="What for? (optional)" value={what} onChangeText={setWhat} placeholder="Lunch, concert tickets…" maxLength={60} />
            <View style={{ gap: 8 }}>
              <T v="label">How much of it do they owe?</T>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 6 }}>
                {option(all, 'All of it', () => setAll(true))}
                {option(!all, 'Half', () => setAll(false))}
              </View>
            </View>
            {cents > 0 && friend.trim() ? (
              <T v="muted" style={{ textAlign: 'center' }}>{friend.trim().split(' ')[0]} will owe you {formatCents(theirPart)}. You'll pick how to send the link next.</T>
            ) : null}
          </ScrollView>
          <View style={{ gap: 6, paddingBottom: 8 }}>
            <ErrorNote message={error} />
            <Button title={cents > 0 ? `Request ${formatCents(theirPart)}` : 'Request'} icon={<SendIcon size={18} color="#FFFFFF" />} onPress={send} loading={busy} disabled={!ready} />
            <T v="small" style={{ textAlign: 'center' }}>Gloslate never moves money. They pay you in Venmo, Cash App or Zelle.</T>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
