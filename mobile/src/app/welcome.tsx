import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View } from 'react-native';

import { HouseMark } from '@/components/icons';
import { Button, ErrorNote, Field, NightSurface, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type SignInResult } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function Welcome() {
  const { signIn } = useSession();
  const { wide } = useLayout();
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ channel: string; destination: string }>('/v1/auth/codes', { body: { destination }, token: null });
      router.push({ pathname: '/code', params: { destination: res.destination, channel: res.channel } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function withApple() {
    setError(null);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('no token');
      const res = await api<SignInResult>('/v1/auth/apple', {
        token: null,
        body: { id_token: cred.identityToken, first_name: cred.fullName?.givenName, last_name: cred.fullName?.familyName,
          device_name: 'iPhone', platform: Platform.OS },
      });
      if (res.status === 'signed_in') {
        await signIn(res.token);
        router.replace('/');
      } else {
        setError(`You already have an account with that email. Sign in with your ${res.existing_methods[0]} first, then link Apple in Settings.`);
      }
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(e instanceof ApiError ? e.message : "Couldn't sign in with Apple. Try again.");
    }
  }

  return (
    <NightSurface fireflies style={{ flex: 1 }}>
    <StatusBar style="light" />
    <Screen maxWidth={wide ? 980 : HT.maxWidth.form} background="transparent">
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: wide ? 56 : 28, alignItems: wide ? 'center' : 'stretch',
        justifyContent: 'center', paddingVertical: wide ? 40 : 24 }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 18, paddingTop: wide ? 0 : 36 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <HouseMark size={wide ? 72 : 60} inverted />
            <View>
              <Text accessibilityLabel="Gloslate" maxFontSizeMultiplier={1.4}
                style={{ fontFamily: HT.font.displayBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.9, color: HT.color.onDarkText }}>
                <Text style={{ color: HT.color.glow, textShadowColor: HT.color.glowHalo, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } }}>glo</Text>slate
              </Text>
              <T v="small" style={{ fontFamily: HT.font.label, fontSize: 11, letterSpacing: 1.1, color: HT.color.darkCardMuted }}>BY GLOFLY</T>
            </View>
          </View>
          <T v="display" style={{ fontSize: wide ? 44 : 36, lineHeight: wide ? 50 : 42, color: HT.color.onDarkText }} accessibilityRole="header">
            No more{'\n'}“you owe me”{'\n'}texts.
          </T>
          <T v="body" style={{ color: HT.color.darkCardMuted, fontSize: 16.5, lineHeight: 24, maxWidth: 420 }}>
            Gloslate keeps a running tab of rent, bills and groceries, does the math, and tells everyone exactly what to send.
          </T>
        </View>

        <View style={{ flex: wide ? 1 : undefined, gap: 14, backgroundColor: HT.color.surface,
          borderRadius: HT.radius.card, padding: wide ? 28 : 20 }}>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={HT.radius.button}
              style={{ height: 54, width: '100%' }}
              onPress={withApple}
            />
          ) : null}
          {appleAvailable ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: HT.color.hairline }} />
              <T v="small">or</T>
              <View style={{ flex: 1, height: 1, backgroundColor: HT.color.hairline }} />
            </View>
          ) : null}
          <Field
            label="Phone or email"
            value={destination}
            onChangeText={setDestination}
            placeholder="(859) 555-0101 or you@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          <ErrorNote message={error} />
          <Button title="Send me a code" onPress={sendCode} loading={busy} disabled={destination.trim().length < 5} />
          <T v="small" style={{ textAlign: 'center' }}>Gloslate never holds or moves your money.</T>
        </View>
      </View>
    </Screen>
    </NightSurface>
  );
}
