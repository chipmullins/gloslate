import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { api } from '@/lib/api';

/**
 * Keeps an open screen current without pull-to-refresh. While the screen is focused
 * and the app is in front, it asks the server "has anything changed for me?"
 * (`GET /v1/pulse`, a tiny fingerprint) every few seconds, right away when the app
 * comes back to the front, and when a notification arrives. `onChange` runs only
 * when the fingerprint moves, so nothing reloads while nothing happens.
 */
const EVERY_MS = 10000;
let lastV: string | null = null;
let inflight: Promise<{ v: string; unread: number } | null> | null = null;

function pulse() {
  inflight ??= api<{ v: string; unread: number }>('/v1/pulse').catch(() => null).finally(() => { inflight = null; });
  return inflight;
}

export function useLive(onChange: (info: { unread: number }) => void) {
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });
  useFocusEffect(useCallback(() => {
    let alive = true;
    let seen = lastV;
    const check = async () => {
      if (AppState.currentState !== 'active' && Platform.OS !== 'web') return;
      const r = await pulse();
      if (!alive || !r) return;
      lastV = r.v;
      if (seen !== null && r.v !== seen) cb.current({ unread: r.unread });
      seen = r.v;
    };
    check();
    const timer = setInterval(check, EVERY_MS);
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    const push = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(() => { check(); });
    const onVisible = () => { if (globalThis.document?.visibilityState === 'visible') check(); };
    if (Platform.OS === 'web') globalThis.document?.addEventListener?.('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      app.remove();
      push?.remove();
      if (Platform.OS === 'web') globalThis.document?.removeEventListener?.('visibilitychange', onVisible);
    };
  }, []));
}
