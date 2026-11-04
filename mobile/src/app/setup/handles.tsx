import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorNote, Field, Screen, Steps, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError } from '@/lib/api';

export default function PaymentHandles() {
  const { householdId, memberId } = useLocalSearchParams<{ householdId: string; memberId: string }>();
  const { wide } = useLayout();
  const [venmo, setVenmo] = useState('');
  const [cashtag, setCashtag] = useState('');
  const [zelle, setZelle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const any = [venmo, cashtag, zelle].some((v) => v.trim());

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/households/${householdId}/members/${memberId}`, {
        method: 'PATCH',
        body: { venmo_handle: venmo, cashtag, zelle_contact: zelle },
      });
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      maxWidth={HT.maxWidth.form}
      footer={
        <View style={{ gap: 4 }}>
          <Button title={any ? 'Save' : 'Skip for now'} kind={any ? 'primary' : 'secondary'} onPress={any ? save : () => router.replace('/home')} loading={busy} />
        </View>
      }>
      <View style={{ gap: 22, paddingTop: 8 }}>
        <Steps total={3} current={3} />
        <View style={{ gap: 8 }}>
          <T v="display" accessibilityRole="header">How should people pay you?</T>
          <T v="muted">These fill in the Pay buttons when someone settles up with you. HomeTab never touches the money.</T>
        </View>
        <View style={{ gap: 16, flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap' }}>
          <View style={{ flexBasis: wide ? '47%' : 'auto', flexGrow: 1 }}>
            <Field label="Venmo username" value={venmo} onChangeText={setVenmo} placeholder="@chip-mullins" autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={{ flexBasis: wide ? '47%' : 'auto', flexGrow: 1 }}>
            <Field label="Cash App $cashtag" value={cashtag} onChangeText={setCashtag} placeholder="$chipm" autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={{ flexBasis: '100%' }}>
            <Field label="Zelle email or phone" value={zelle} onChangeText={setZelle} placeholder="The one your bank uses"
              autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
          </View>
        </View>
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
