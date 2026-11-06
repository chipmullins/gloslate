import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, PlusIcon } from '@/components/icons';
import { Button, ErrorNote, Field, IconButton, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Household } from '@/lib/api';
import { useSession } from '@/lib/session';
import { goBack } from '@/lib/nav';

const MAX_PEOPLE = 19; // plus you = 20

/** Start a group: a name and who's in it. People can join later from a link. */
export default function NewGroup() {
  const { user, refresh } = useSession();
  const needsName = !user?.first_name;
  const [myName, setMyName] = useState('');
  const [name, setName] = useState('');
  const [people, setPeople] = useState<{ key: number; name: string }[]>([{ key: 0, name: '' }, { key: 1, name: '' }]);
  const nextKey = useRef(2);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const names = people.map((p) => p.name.trim()).filter(Boolean);
  const ready = name.trim().length > 0 && names.length > 0 && (!needsName || myName.trim().length > 0);

  async function create() {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (needsName) await api('/v1/me', { method: 'PATCH', body: { first_name: myName.trim() } });
      const res = await api<{ data: Household }>('/v1/households', { body: { kind: 'group', name: name.trim(), roommates: names } });
      await refresh();
      router.replace(`/group/${res.data.id}` as Href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
            <IconButton label="Close" onPress={() => goBack('/groups' as Href)}><CloseIcon /></IconButton>
            <T v="heading" accessibilityRole="header" style={{ fontSize: 16 }}>New group</T>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            {needsName ? <Field label="Your first name" value={myName} onChangeText={setMyName} autoCapitalize="words" textContentType="givenName" /> : null}
            <Field label="What's it for?" value={name} onChangeText={setName} placeholder="Beach trip, Friday dinners…" maxLength={60} autoFocus returnKeyType="next" />
            <View style={{ gap: 10 }}>
              <T v="label">Who's in it, besides you?</T>
              {people.map((p, i) => (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput value={p.name} onChangeText={(t) => setPeople((cur) => cur.map((x) => (x.key === p.key ? { ...x, name: t } : x)))}
                    placeholder={i === 0 ? 'First name' : 'Another person'} placeholderTextColor={HT.color.faint} maxLength={40}
                    accessibilityLabel={`Person ${i + 1}`} returnKeyType="next" autoCapitalize="words"
                    style={{ flex: 1, height: 52, paddingVertical: 0, paddingHorizontal: 16, borderRadius: HT.radius.tile, borderWidth: 1, borderColor: HT.color.chipBorder,
                      backgroundColor: HT.color.surface, fontFamily: HT.font.semibold, fontSize: 16, color: HT.color.ink }} />
                  {people.length > 1 ? (
                    <IconButton label={`Remove person ${i + 1}`} onPress={() => setPeople((cur) => cur.filter((x) => x.key !== p.key))}><CloseIcon size={18} color={HT.color.muted} /></IconButton>
                  ) : null}
                </View>
              ))}
              {people.length < MAX_PEOPLE ? (
                <Pressable accessibilityRole="button" onPress={() => setPeople((cur) => [...cur, { key: nextKey.current++, name: '' }])}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, opacity: pressed ? 0.6 : 1 })}>
                  <PlusIcon size={16} color={HT.color.brand} />
                  <T v="strong" style={{ color: HT.color.brand }}>Add someone</T>
                </Pressable>
              ) : null}
              <T v="small">They don't need the app. You can send each person a link to join, or just request money from them.</T>
            </View>
          </ScrollView>
          <View style={{ gap: 6, paddingBottom: 8 }}>
            <ErrorNote message={error} />
            <Button title={ready ? `Start ${name.trim()}` : 'Name it and add someone'} onPress={create} loading={busy} disabled={!ready} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
