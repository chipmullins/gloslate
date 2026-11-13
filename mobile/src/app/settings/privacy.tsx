import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { RowGroup, Section, SettingsPage, Toggle, useMySettings } from '@/components/settings';
import { T } from '@/components/ui';

const NAMES: Record<string, string> = { email: 'Email', phone: 'Phone', apple: 'Apple', google: 'Google', glofly: 'Glofly' };

export default function PrivacySettings() {
  const { user, error, patchMe } = useMySettings();
  const [biometrics, setBiometrics] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(([h, e]) => setBiometrics(h && e)).catch(() => {});
  }, []);
  if (!user) return null;
  return (
    <SettingsPage title="Privacy & security" error={error}>
      {biometrics ? (
        <Section title="Lock">
          <Toggle label="Lock with Face ID" hint="Asks when you open Gloslate" value={user.face_id_lock}
            onChange={async (v) => {
              const ok = v ? (await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on Face ID lock' })).success : true;
              if (ok) patchMe({ face_id_lock: v }, v ? 'Gloslate will ask for Face ID' : 'Face ID lock off');
            }} />
        </Section>
      ) : null}
      <RowGroup rows={[{ title: 'Sign-in methods', sub: user.identities.map((i) => NAMES[i.provider] ?? i.provider).join(' · '), href: '/sign-in-methods' }]} />
      <Section title="Who sees what">
        <T v="small">People you share a tab with see your first name, your photo and what you split together. Friends see your name and photo. Request pages show first names, amounts and the breakdown only.</T>
      </Section>
    </SettingsPage>
  );
}
