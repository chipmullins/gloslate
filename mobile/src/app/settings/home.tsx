import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Section, SettingsPage, Toggle, useMySettings } from '@/components/settings';
import { ordinal, Stepper } from '@/components/stepper';
import { Avatar, Button, Field, T } from '@/components/ui';
import { api, type Member } from '@/lib/api';
import { formatCents } from '@/lib/money';

function confirm(title: string, message: string, action: string, go: () => void) {
  if (Platform.OS === 'web') return go();
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: go }]);
}

/** The home you live in: name, statement day, simplify debts, who lives there. */
export default function HomeSettings() {
  const { home, homeId, me, error, run, patchHome } = useMySettings();
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(home);
  if (home && home !== loaded) { setLoaded(home); setName(home.name); }
  if (!home || !homeId || home.kind === 'group') return <SettingsPage title="Home" error={error}><T v="muted">You're not in a home yet.</T></SettingsPage>;

  function removeMember(m: Member, you = false) {
    const owes = home?.balance.with.find((w) => w.member_id === m.id);
    const go = (forgive: boolean) => run(async () => {
      await api(`/v1/households/${homeId}/members/${m.id}${forgive ? '?forgive=true' : ''}`, { method: 'DELETE' });
      if (you) router.replace('/home');
    }, you ? 'You left the home' : `${m.first_name} moved out`);
    if (owes && owes.cents !== 0 && Platform.OS !== 'web') {
      Alert.alert(`${m.first_name} has an open balance`, `Settle up first, or forgive ${formatCents(Math.abs(owes.cents))}. Forgiving is logged for everyone.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Forgive and remove', style: 'destructive', onPress: () => go(true) },
      ]);
    } else if (you) confirm('Leave this home?', 'Your past expenses stay in the history.', 'Leave', () => go(false));
    else confirm(`Remove ${m.first_name}?`, 'Their past expenses stay in the history.', 'Remove', () => go(false));
  }
  const roommates = home.members.filter((m) => !m.you && !m.former);

  return (
    <SettingsPage title={home.name || 'Home'} error={error}>
      <Section title="Home">
        <Field label="Name" value={name} onChangeText={setName} onEndEditing={() => name.trim() && name !== home.name && patchHome({ name: name.trim() }, 'Saved. Everyone sees the change.')} />
        <Stepper label="Monthly statement on the" value={home.statement_day} min={1} max={28} onChange={(v) => patchHome({ statement_day: v })} format={ordinal} />
        {home.members.filter((m) => !m.former).length > 2 ? (
          <Toggle label="Simplify debts" hint="Fewest transfers to settle the whole house" value={home.simplify_debts} onChange={(v) => patchHome({ simplify_debts: v })} />
        ) : null}
      </Section>
      <Section title="People">
        {roommates.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
            <Avatar name={m.first_name} index={home.members.indexOf(m)} size={34} photo={m.photo_url} />
            <View style={{ flex: 1 }}>
              <T v="strong">{m.display_name}</T>
              <T v="small">{m.placeholder ? 'Not joined yet' : m.moved_out_on ? `Moving out ${m.moved_out_on}` : m.moved_in_on ? `Moved in ${m.moved_in_on}` : 'Lives here'}</T>
            </View>
            <Button title="Remove" kind="link" onPress={() => removeMember(m)} />
          </View>
        ))}
        <T v="small">Any change here is logged and shown to everyone.</T>
      </Section>
      {me ? <Button title="Leave this home" kind="link" onPress={() => removeMember({ ...me, first_name: 'You' } as Member, true)} /> : null}
    </SettingsPage>
  );
}
