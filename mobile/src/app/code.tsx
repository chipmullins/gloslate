import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { BackIcon } from '@/components/icons';
import { Button, ErrorNote, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type SignInResult } from '@/lib/api';
import { useSession } from '@/lib/session';
import { goBack } from '@/lib/nav';

const LENGTH = 6;

export default function Code() {
  const { destination, channel } = useLocalSearchParams<{ destination: string; channel: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const input = useRef<TextInputInstance>(null);

  async function verify(value = code) {
    if (value.length !== LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<SignInResult>('/v1/auth/codes/verify', {
        token: null,
        body: { destination, code: value, platform: Platform.OS, device_name: Platform.OS === 'ios' ? 'iPhone' : 'Android' },
      });
      if (res.status === 'signed_in') {
        await signIn(res.token);
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api('/v1/auth/codes', { body: { destination }, token: null });
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 24 }}>
        <IconButton label="Back" onPress={() => goBack('/welcome' as Href)}><BackIcon /></IconButton>
        <View style={{ gap: 8 }}>
          <T v="title" accessibilityRole="header">Enter the code</T>
          <T v="muted">We sent a 6-digit code to {channel === 'phone' ? 'your phone' : 'your email'}, {destination}.</T>
        </View>

        <Pressable onPress={() => input.current?.focus()} accessibilityRole="button" accessibilityLabel={`Code entry, ${code.length} of ${LENGTH} digits entered`} style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = i === code.length;
            return (
              <View key={i} style={{ flex: 1, aspectRatio: 0.82, maxHeight: 72, borderRadius: HT.radius.tile, backgroundColor: HT.color.surface,
                borderWidth: active ? 2 : 1, borderColor: active ? HT.color.brand : HT.color.chipBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: HT.font.monoBold, fontSize: 26, color: HT.color.ink, fontVariant: ['tabular-nums'] }}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '').slice(0, LENGTH);
            setCode(digits);
            if (digits.length === LENGTH) verify(digits);
          }}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          accessibilityLabel="6-digit code"
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />

        <ErrorNote message={error} />
        <Button title="Continue" onPress={() => verify()} loading={busy} disabled={code.length !== LENGTH} />
        <Button title={resent ? 'Sent again' : 'Send a new code'} kind="link" onPress={resend} disabled={resent} />
      </View>
    </Screen>
  );
}
