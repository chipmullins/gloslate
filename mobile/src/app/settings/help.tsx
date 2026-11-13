import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Linking, View } from 'react-native';

import { Section, SettingsPage } from '@/components/settings';
import { Button, T } from '@/components/ui';

const SITE = 'https://gloslate.app';

export default function HelpSettings() {
  const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE}${path}`).catch(() => {});
  return (
    <SettingsPage title="Help & legal">
      <Section title="Help">
        <Button title="Email support" kind="secondary" onPress={() => Linking.openURL('mailto:support@gloslate.app').catch(() => {})} />
        <T v="small">support@gloslate.app. A real person reads every message.</T>
      </Section>
      <Section title="Legal">
        <View style={{ gap: 10 }}>
          <Button title="Privacy policy" kind="secondary" onPress={() => open('/privacy')} />
          <Button title="Terms" kind="secondary" onPress={() => open('/terms')} />
        </View>
      </Section>
      <T v="small" style={{ textAlign: 'center' }}>Gloslate {Constants.expoConfig?.version ?? ''} · by Glofly · Gloslate never holds or moves money.</T>
    </SettingsPage>
  );
}
