import * as AppleAuthentication from 'expo-apple-authentication';
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { BackIcon, CheckIcon } from '@/components/icons';
import { Button, Card, ErrorNote, Field, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type User } from '@/lib/api';
import { goBack } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

type Identity = User['identities'][number];
const NAMES: Record<string, string> = { email: 'Email', phone: 'Phone', apple: 'Apple', google: 'Google', glofly: 'Glofly' };

/** "+15025550101" → "(502) 555-0101"; anything else as is. */
export function prettyPhone(p: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function describe(i: Identity) {
  if (i.provider === 'phone') return i.label ? prettyPhone(i.label) : 'Phone number';
  if (i.provider === 'apple') return i.label?.endsWith('privaterelay.appleid.com') ? 'Hidden email (Apple)' : i.label ?? 'Apple ID';
  return i.label ?? '';
}

/** What you can sign in with, and adding another way (so losing a phone number never locks you out). */
export default function SignInMethods() {
  const { user, refresh } = useSession();
  const [adding, setAdding] = useState<'email' | 'phone' | null>(null);
  const [destination, setDestination] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  if (!user) return null;
  const ids = user.identities;
  const has = (p: string) => ids.some((i) => i.provider === p);

  function reset() {
    setAdding(null);
    setDestination('');
    setSentTo(null);
    setCode('');
    setError(null);
  }

  async function sendCode() {
    const dest = destination.trim();
    if (!dest) return setError(adding === 'email' ? 'Enter your email' : 'Enter your phone number');
    setBusy(true);
    setError(null);
    try {
      await api('/v1/auth/codes', { body: { destination: dest }, token: null });
      setSentTo(dest);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo || code.length !== 6) return setError('Enter the 6-digit code');
    setBusy(true);
    setError(null);
    try {
      await api('/v1/identities', { body: { destination: sentTo, code } });
      await refresh();
      toast.show({ text: `Added. You can sign in with ${adding === 'email' ? 'this email' : 'this number'} now.` });
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code didn’t work.');
    } finally {
      setBusy(false);
    }
  }

  async function addApple() {
    setError(null);
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!cred.identityToken) throw new Error('no token');
      await api('/v1/identities', { body: { provider: 'apple', id_token: cred.identityToken } });
      await refresh();
      toast.show({ text: 'Added Sign in with Apple.' });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(e instanceof ApiError ? e.message : "Couldn't add Apple. Try again.");
    }
  }

  function remove(i: Identity) {
    const go = async () => {
      try {
        await api(`/v1/identities/${i.id}`, { method: 'DELETE' });
        await refresh();
        toast.show({ text: `Removed ${NAMES[i.provider] ?? i.provider}.` });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't remove it.");
      }
    };
    const msg = `You won't be able to sign in with ${describe(i) || NAMES[i.provider]} anymore.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) go();
    } else {
      Alert.alert(`Remove ${NAMES[i.provider] ?? i.provider}?`, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
    }
  }

  const addRow = (title: string, sub: string, onPress: () => void) => (
    <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <T v="strong" style={{ color: HT.color.brand, fontSize: 18, lineHeight: 20 }}>+</T>
      </View>
      <View style={{ flex: 1 }}>
        <T v="strong">{title}</T>
        <T v="small">{sub}</T>
      </View>
    </Pressable>
  );

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }}>
        <IconButton label="Back" onPress={() => goBack('/you' as Href)}><BackIcon /></IconButton>
        <T v="heading" accessibilityRole="header" style={{ fontSize: 18 }}>Sign-in methods</T>
      </View>
      <View style={{ gap: 18 }}>
        <T v="muted">Any of these signs you in to the same account. Adding a second one means you can still get in if you change your number or email.</T>

        <Card style={{ paddingVertical: 4 }}>
          {ids.map((i, n) => (
            <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60,
              borderBottomWidth: n < ids.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
              <CheckIcon size={18} color={HT.color.owedToYou} />
              <View style={{ flex: 1 }}>
                <T v="strong">{NAMES[i.provider] ?? i.provider}</T>
                {describe(i) ? <T v="small" numberOfLines={1}>{describe(i)}</T> : null}
              </View>
              {ids.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${NAMES[i.provider] ?? i.provider}`} onPress={() => remove(i)} hitSlop={8}
                  style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
                  <T v="strong" style={{ color: HT.color.muted, fontSize: 13 }}>Remove</T>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>

        {adding ? (
          <Card style={{ gap: 12 }}>
            <T v="strong">{adding === 'email' ? 'Add an email' : 'Add a phone number'}</T>
            {sentTo ? (
              <>
                <T v="small">We sent a 6-digit code to {adding === 'phone' ? prettyPhone(sentTo) : sentTo}.</T>
                <Field label="Code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
                  autoComplete="one-time-code" textContentType="oneTimeCode" />
                <Button title="Add it" onPress={verify} loading={busy} disabled={code.length !== 6} />
              </>
            ) : (
              <>
                <Field label={adding === 'email' ? 'Email' : 'Phone number'} value={destination} onChangeText={setDestination}
                  keyboardType={adding === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" autoCorrect={false}
                  autoComplete={adding === 'email' ? 'email' : 'tel'} />
                <Button title="Send a code" onPress={sendCode} loading={busy} />
              </>
            )}
            <Button kind="link" title="Cancel" onPress={reset} />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {!has('phone') ? addRow('Add a phone number', 'Sign in with a text code', () => setAdding('phone')) : null}
            {!has('email') ? addRow('Add an email', 'Sign in with an emailed code', () => setAdding('email')) : null}
            {appleAvailable && !has('apple') ? addRow('Add Sign in with Apple', 'One tap on iPhone and iPad', addApple) : null}
            {has('phone') && has('email') && (has('apple') || !appleAvailable) ? (
              <T v="small" style={{ paddingVertical: 16 }}>You have every sign-in method available here.</T>
            ) : null}
          </Card>
        )}
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
