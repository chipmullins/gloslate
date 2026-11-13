import { View } from 'react-native';

import { Section, Segmented, SettingsPage, useMySettings } from '@/components/settings';
import { Stepper } from '@/components/stepper';
import { TestPush } from '@/components/test-push';
import { T } from '@/components/ui';

const PREF_KINDS = [
  { key: 'expense_added', label: 'Expenses that include you' },
  { key: 'bill_posted', label: 'Bills posting with your share' },
  { key: 'payment_confirmed', label: 'Your payments confirmed' },
  { key: 'statement_ready', label: 'Monthly statement ready' },
] as const;
const CHOICES = [{ key: 'on', label: 'Right away' }, { key: 'daily', label: 'Daily' }, { key: 'off', label: 'Off' }] as const;
export const hour = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

export default function NotificationSettings() {
  const { user, error, patchMe } = useMySettings();
  if (!user) return null;
  const prefs = user.notification_prefs ?? {};
  return (
    <SettingsPage title="Notifications" error={error}>
      <Section title="What you get">
        {PREF_KINDS.map((k) => (
          <View key={k.key} style={{ gap: 6 }}>
            <T v="strong">{k.label}</T>
            <Segmented label={k.label} value={prefs[k.key] ?? 'on'} options={[...CHOICES]} onChange={(v) => patchMe({ notification_prefs: { [k.key]: v } })} />
          </View>
        ))}
        <T v="small">Requests, payments marked, and bill amounts needed always come through.</T>
      </Section>
      <Section title="Quiet hours">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Stepper label="Quiet from" value={user.quiet_start_hour} min={0} max={23} onChange={(v) => patchMe({ quiet_start_hour: v })} format={hour} /></View>
          <View style={{ flex: 1 }}><Stepper label="Until" value={user.quiet_end_hour} min={0} max={23} onChange={(v) => patchMe({ quiet_end_hour: v })} format={hour} /></View>
        </View>
        <T v="small">Nothing buzzes during quiet hours. It waits until they end.</T>
      </Section>
      <Section title="Check it works">
        <TestPush />
      </Section>
    </SettingsPage>
  );
}
