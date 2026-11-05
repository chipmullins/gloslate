import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CloseIcon, PlusIcon } from '@/components/icons';
import { Avatar, Button, ErrorNote, Field, Screen, Steps, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Household } from '@/lib/api';
import { useSession } from '@/lib/session';

const MAX_ROOMMATES = 4;

export default function WhoDoYouLiveWith() {
  const { user, refresh } = useSession();
  const needsName = !user?.first_name;
  const [myName, setMyName] = useState('');
  const [names, setNames] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = names.map((n) => n.trim()).filter(Boolean);
  const canContinue = filled.length > 0 && (!needsName || myName.trim().length > 0);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      if (needsName) await api('/v1/me', { method: 'PATCH', body: { first_name: myName.trim() } });
      const res = await api<{ data: Household }>('/v1/households', { body: { roommates: filled } });
      await refresh();
      router.replace({ pathname: '/setup/bills', params: { householdId: res.data.id, memberId: res.data.me.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={HT.maxWidth.form} footer={<Button title="Continue" onPress={create} loading={busy} disabled={!canContinue} />}>
      <View style={{ gap: 22, paddingTop: 8 }}>
        <Steps total={3} current={1} />
        <View style={{ gap: 8 }}>
          <T v="display" accessibilityRole="header">Who do you live with?</T>
          <T v="muted">Just their first name. They can join later; you can start logging right away.</T>
        </View>

        {needsName ? (
          <Field label="Your first name" value={myName} onChangeText={setMyName} placeholder="Chip"
            autoCapitalize="words" textContentType="givenName" autoComplete="given-name" />
        ) : null}

        <View style={{ gap: 10 }}>
          <T v="label">{filled.length > 1 ? 'Roommates' : 'Partner or roommate'}</T>
          {names.map((name, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={name || '?'} index={i + 1} size={44} />
              <View style={{ flex: 1 }}>
                <Field
                  label={`Person ${i + 1}`}
                  value={name}
                  onChangeText={(t) => setNames((all) => all.map((n, j) => (j === i ? t : n)))}
                  placeholder={i === 0 ? 'Alex' : 'Name'}
                  autoCapitalize="words"
                  autoFocus={i === names.length - 1 && i > 0}
                  hideLabel
                />
              </View>
              {names.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name || `person ${i + 1}`}`} hitSlop={8}
                  onPress={() => setNames((all) => all.filter((_, j) => j !== i))}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <CloseIcon size={18} color={HT.color.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {names.length < MAX_ROOMMATES ? (
            <Pressable accessibilityRole="button" onPress={() => setNames((all) => [...all, ''])}
              style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: HT.color.chipBorder,
                alignItems: 'center', justifyContent: 'center' }}>
                <PlusIcon size={18} color={HT.color.brand} />
              </View>
              <T v="strong" style={{ color: HT.color.brand }}>Add another person</T>
            </Pressable>
          ) : (
            <T v="small">Up to 5 people per home.</T>
          )}
        </View>
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
