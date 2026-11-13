import { useState } from 'react';

import { Section, SettingsPage, Toggle, useMySettings } from '@/components/settings';
import { Stepper } from '@/components/stepper';
import { loadTones, TonePicker } from '@/components/tone-picker';
import { Field, T } from '@/components/ui';
import { centsFirst, parseCents } from '@/lib/money';

export default function ReminderSettings() {
  const { me, error, patchMine } = useMySettings();
  const [threshold, setThreshold] = useState('');
  const [loaded, setLoaded] = useState(me);
  if (me && me !== loaded) { setLoaded(me); setThreshold(centsFirst(String(me.remind_threshold_cents ?? 4000))); }

  return (
    <SettingsPage title="Reminders" error={error}>
      {me ? (
        <>
          <Section title="Automatic nudges">
            <Toggle label="Let Gloslate nudge people for you" hint="So nobody has to be the bad guy" value={me.auto_remind ?? true} onChange={(v) => patchMine({ auto_remind: v })} />
            {me.auto_remind !== false ? (
              <>
                <Field label="When someone owes you at least" value={threshold} onChangeText={(t) => setThreshold(centsFirst(t))} keyboardType="number-pad"
                  onEndEditing={() => { const c = parseCents(threshold); if (c) patchMine({ remind_threshold_cents: c }, 'Saved'); }} />
                <Stepper label="Or it's been this long" value={me.remind_after_days ?? 7} min={1} max={30} onChange={(v) => patchMine({ remind_after_days: v })} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
                <T v="small">At most one nudge every 3 days, never during quiet hours, and it stops the moment a payment is marked.</T>
              </>
            ) : null}
          </Section>
          <Section title="Tone">
            <TonePicker value={me.reminder_tone ?? 'plain'} preview="reminder" label="How Gloslate asks for you"
              onChange={(t) => { if (t !== (me.reminder_tone ?? 'plain')) patchMine({ reminder_tone: t }, 'Saved. New requests and nudges use it.'); loadTones(true).catch(() => {}); }} />
            <T v="small">Used for nudges, requests and the text you share. You can pick another for a single request.</T>
          </Section>
        </>
      ) : <T v="muted">Reminders start once you share a tab with someone.</T>}
    </SettingsPage>
  );
}
