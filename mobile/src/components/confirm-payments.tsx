import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Pressable, View } from 'react-native';

import { BellIcon } from '@/components/icons';
import { Button, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Balance, type NotificationItem, type Payment } from '@/lib/api';
import { celebrateIfSettled } from '@/lib/celebrate';
import { formatCents } from '@/lib/money';
import { toast } from '@/lib/toast';

/**
 * Payments someone marked as sent to you, waiting for you to say they arrived.
 * Shown wherever the money is (home, a group, a settle-up screen) so nobody
 * has to find them in notifications.
 */
export function ConfirmPayments({ payments, nameOf, onDone, oneOnOne }: {
  payments: Payment[]; nameOf: (memberId: string) => string; onDone: () => void;
  /** Just you and one other person: the celebration names them. */
  oneOnOne?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mine = payments.filter((p) => p.can_confirm);
  if (mine.length === 0) return null;

  async function confirm(p: Payment) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(p.id);
    setError(null);
    try {
      const res = await api<{ balance?: Balance }>(`/v1/payments/${p.id}/confirm`, { body: {} });
      const played = celebrateIfSettled({ balance: res.balance, otherId: p.from_member_id, otherName: nameOf(p.from_member_id), amountCents: p.amount_cents, key: p.id });
      if (!played) toast.show({ text: `Confirmed ${formatCents(p.amount_cents)} from ${nameOf(p.from_member_id)}` });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't confirm it. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {mine.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: HT.color.brandTint, borderRadius: HT.radius.tile, padding: 12 }}>
          <Pressable style={{ flex: 1, gap: 2 }} accessibilityRole="button" accessibilityLabel={`${nameOf(p.from_member_id)} marked ${formatCents(p.amount_cents)} paid. See details.`}
            onPress={() => router.push(`/payments/${p.id}` as Href)}>
            <T v="strong" style={{ color: HT.color.brand }}>{nameOf(p.from_member_id)} marked {formatCents(p.amount_cents)} paid</T>
            <T v="small">{p.auto_confirm_at ? 'Did it arrive? Confirms itself in 3 days.' : 'Did it arrive? Tap for details or to say it didn’t.'}</T>
          </Pressable>
          <Button title="Confirm" onPress={() => confirm(p)} loading={busy === p.id} disabled={!!busy} style={{ minHeight: 44, paddingHorizontal: 14 }} />
        </View>
      ))}
      {error ? <T v="small" style={{ color: HT.color.youOwe }}>{error}</T> : null}
    </View>
  );
}

/** The bell in a tab's header, with a dot when something's new. */
/** The bell: a numbered badge and a tinted bell when something's waiting; one small shake when a new one arrives. */
export function NotificationBell({ unread }: { unread: number }) {
  const reduce = useReducedMotion();
  const tilt = useSharedValue(0);
  const prev = useRef(unread);
  useEffect(() => {
    if (unread > prev.current && !reduce) {
      tilt.value = withSequence(withTiming(-14, { duration: 70 }), withTiming(12, { duration: 90 }), withTiming(-8, { duration: 80 }), withTiming(5, { duration: 70 }), withTiming(0, { duration: 60 }));
    }
    prev.current = unread;
  }, [unread, reduce, tilt]);
  const shake = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  const on = unread > 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={on ? `Notifications, ${unread} new` : 'Notifications'} onPress={() => router.push('/notifications' as Href)}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: on ? 1.5 : 1, borderColor: on ? HT.color.brand : HT.color.chipBorder,
        backgroundColor: on ? HT.color.brandTint : HT.color.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Animated.View style={shake}><BellIcon size={20} color={on ? HT.color.brand : HT.color.ink} /></Animated.View>
      {on ? (
        <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: HT.color.youOwe,
          alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: HT.color.ground }}>
          <T style={{ fontFamily: HT.font.bold, fontSize: 12, lineHeight: 15, color: HT.color.onBrand }} maxFontSizeMultiplier={1.2}>{unread > 9 ? '9+' : unread}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The newest unread notification, previewed under the header. Tap opens it. */
export function LatestNotice({ item }: { item: NotificationItem | null }) {
  if (!item || item.read) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`New: ${item.title}. ${item.body}`}
      onPress={() => router.push((item.data?.route ?? '/notifications') as Href)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: HT.radius.tile, backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: HT.color.youOwe }} />
      <T numberOfLines={2} style={{ flex: 1, fontSize: 14 }}><T v="strong" style={{ fontSize: 14 }}>{item.title}</T>{item.body ? `  ${item.body}` : ''}</T>
    </Pressable>
  );
}
