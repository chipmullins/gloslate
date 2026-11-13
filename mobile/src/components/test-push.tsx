import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { registerDevice } from '@/lib/push';

type Device = { device: string; platform?: string; push_status?: string | null; has_token: boolean; push_error?: string | null };
type Result = { device: string; status?: string; error?: string | null };
type TestResult = { sent: number; devices: Device[]; results: Result[] };

/** Plain words for what Expo, Apple or Google said. */
function explain(error?: string | null) {
  const e = error ?? '';
  if (/InvalidCredentials/i.test(e)) return "Apple or Google turned it down because the app's push key isn't set up yet. That's on our side, not your phone.";
  if (/DeviceNotRegistered/i.test(e)) return 'This phone is no longer registered. Open the app again to register it.';
  if (/MessageRateExceeded|TooManyRequests/i.test(e)) return 'Too many notifications at once. Try again in a minute.';
  if (/fcm|firebase|google-services|FirebaseApp/i.test(e)) return "Android notifications aren't set up in this version of the app yet (it needs Firebase). They'll work after the next app update from the store.";
  return e || 'Something went wrong.';
}

/** You → Notifications: "Send a test notification", with what happened on each device. */
export function TestPush() {
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<{ ok: boolean; text: string }[] | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);

  async function run() {
    setBusy(true);
    setLines(null);
    setNeedsSettings(false);
    try {
      await registerDevice(); // picks up a permission turned on since, and reports why if not
      const { data } = await api<{ data: TestResult }>('/v1/notifications/test', { body: {} });
      const out: { ok: boolean; text: string }[] = [];
      for (const r of data.results) {
        out.push(r.status === 'ok' ? { ok: true, text: `Sent to ${r.device}. It should show up in a few seconds.` } : { ok: false, text: `${r.device}: ${explain(r.error)}` });
      }
      for (const d of data.devices.filter((x) => !x.has_token)) {
        if (d.push_status === 'denied') { out.push({ ok: false, text: `${d.device}: notifications are turned off for Gloslate.` }); setNeedsSettings(true); }
        else if (d.platform === 'web') continue;
        else if (d.push_status === 'error' || d.push_status === 'unsupported') out.push({ ok: false, text: `${d.device}: ${explain(d.push_error)}` });
        else if (d.push_error) out.push({ ok: false, text: `${d.device}: ${explain(d.push_error)}` });
      }
      if (!out.length) out.push({ ok: false, text: Platform.OS === 'web' ? 'Notifications go to the iPhone and Android apps. Sign in there to get them.' : "This phone hasn't registered for notifications yet. Close and reopen Gloslate, then try again." });
      setLines(out);
    } catch (e) {
      setLines([{ ok: false, text: e instanceof ApiError ? e.message : "Couldn't send a test right now." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Button title="Send a test notification" kind="secondary" loading={busy} onPress={run} />
      {lines?.map((l, i) => (
        <T key={i} v="small" accessibilityLiveRegion="polite" style={{ color: l.ok ? HT.color.owedToYou : HT.color.youOwe }}>{l.text}</T>
      ))}
      {needsSettings && Platform.OS !== 'web' ? <Button title="Open notification settings" kind="link" onPress={() => Linking.openSettings()} /> : null}
    </View>
  );
}
