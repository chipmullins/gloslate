import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Registers this device for push and keeps the server's time zone current (quiet hours). */
export async function registerDevice() {
  const tz = Localization.getCalendars()[0]?.timeZone;
  if (tz) api('/v1/me', { method: 'PATCH', body: { time_zone: tz } }).catch(() => {});
  if (Platform.OS === 'web') return;
  // Tell the server what happened either way, so "Send a test notification" can explain a silent phone.
  const report = (push_status: string, push_error?: string) =>
    api('/v1/session', { method: 'PATCH', body: { push_status, push_error: push_error ?? '', app_version: Constants.expoConfig?.version } }).catch(() => {});
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') { await report('denied'); return; }
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) { await report('unsupported', 'This build has no push project ID'); return; }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/v1/session', { method: 'PATCH', body: { push_token: data, push_status: 'granted', push_error: '', app_version: Constants.expoConfig?.version } });
  } catch (e) {
    // Android builds without Firebase set up land here, as do simulators and Expo Go.
    await report('error', e instanceof Error ? e.message : String(e));
  }
}

/** Every notification deep-links to the exact screen. */
export function listenForTaps() {
  if (Platform.OS === 'web') return () => {};
  const open = (route?: unknown) => { if (typeof route === 'string' && route.startsWith('/')) router.push(route as Href); };
  const last = Notifications.getLastNotificationResponse();
  if (last) open(last.notification.request.content.data?.route);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.route));
  return () => sub.remove();
}
