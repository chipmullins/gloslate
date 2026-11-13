import { useState } from 'react';

import { Section, SettingsPage, useMySettings } from '@/components/settings';
import { Button, Field, T } from '@/components/ui';

/** How people pay you: saved to every tab you're in. */
export default function PaymentSettings() {
  const { me, error, patchMine } = useMySettings();
  const [venmo, setVenmo] = useState('');
  const [cashtag, setCashtag] = useState('');
  const [zelle, setZelle] = useState('');
  // Fill the fields when your saved handles load (adjusting state during render, not in an effect).
  const [loaded, setLoaded] = useState(me);
  if (me && me !== loaded) {
    setLoaded(me);
    setVenmo(me.handles.venmo ?? '');
    setCashtag(me.handles.cashapp ?? '');
    setZelle(me.handles.zelle ?? '');
  }

  return (
    <SettingsPage title="How people pay you" error={error}>
      <Section>
        <Field label="Venmo username" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} placeholder="@your-name" />
        <Field label="Cash App $cashtag" value={cashtag} onChangeText={setCashtag} autoCapitalize="none" autoCorrect={false} placeholder="$you" />
        <Field label="Zelle email or phone" value={zelle} onChangeText={setZelle} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Button title="Save payment apps" onPress={() => patchMine({ venmo_handle: venmo, cashtag, zelle_contact: zelle }, 'Payment apps saved')} />
        <T v="small">Shown on your requests so people can pay you in one tap. Used for your home, one-on-ones and groups. Gloslate never holds or moves money.</T>
      </Section>
    </SettingsPage>
  );
}
