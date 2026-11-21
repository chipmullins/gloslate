import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { api, type NotificationItem } from '@/lib/api';
import { celebrate } from '@/lib/celebrate';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';

/**
 * The payer's side of the clean slate moment. When the other person confirms your
 * "I paid" (or records your payment) and that leaves you square, the server tags
 * the notification with `clean_slate`. This plays it once, whether the push arrives
 * with the app open, or you open the app later.
 */
type Slate = { with_name: string; amount_cents: number; payment_id: string };
const RECENT_MS = 3 * 24 * 3600 * 1000;
const WEB_KEY = 'gloslate.slates';
const file = () => new File(Paths.document, 'slates-played.json');

function loadPlayed(): Set<string> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(WEB_KEY) : file().exists ? file().textSync() : null;
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
const played = loadPlayed();
function remember(ids: string[]) {
  ids.forEach((id) => played.add(id));
  const list = JSON.stringify([...played].slice(-200));
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(WEB_KEY, list);
    else file().write(list);
  } catch {
    // Worst case it could play again once.
  }
}

function play(slate: Slate, ids: string[]) {
  if (ids.every((id) => played.has(id))) return;
  remember(ids);
  celebrate.show({
    title: `Clean slate with ${slate.with_name}.`,
    body: `${slate.with_name} confirmed your ${formatCents(slate.amount_cents)}. Nothing owed either way.`,
    amountCents: slate.amount_cents,
  });
}

/** Looks for confirmations that cleared your slate and haven't played on this device. */
async function check() {
  const r = await api<{ data: NotificationItem[] }>('/v1/notifications').catch(() => null);
  if (!r) return;
  const fresh = r.data.filter((n) => {
    const slate = n.data?.clean_slate;
    return slate && !played.has(slate.payment_id) && Date.now() - new Date(n.created_at).getTime() < RECENT_MS;
  });
  if (!fresh.length) return;
  // Settling several tabs at once sends one per tab: play the newest, once.
  const slates = fresh.map((n) => n.data.clean_slate as Slate);
  play(slates[0], slates.map((s) => s.payment_id));
}

export function CleanSlateWatch() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return;
    check();
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    const push = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener((n) => {
      const slate = (n.request.content.data as { clean_slate?: Slate } | undefined)?.clean_slate;
      if (slate) play(slate, [slate.payment_id]);
    });
    const onVisible = () => { if (globalThis.document?.visibilityState === 'visible') check(); };
    if (Platform.OS === 'web') globalThis.document?.addEventListener?.('visibilitychange', onVisible);
    // The web app gets no pushes, so it also looks every so often.
    const timer = Platform.OS === 'web' ? setInterval(check, 20000) : null;
    return () => {
      app.remove();
      push?.remove();
      if (timer) clearInterval(timer);
      if (Platform.OS === 'web') globalThis.document?.removeEventListener?.('visibilitychange', onVisible);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
