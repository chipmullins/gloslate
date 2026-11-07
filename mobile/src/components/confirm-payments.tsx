import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BellIcon } from '@/components/icons';
import { Button, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Payment } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { toast } from '@/lib/toast';

/**
 * Payments someone marked as sent to you, waiting for you to say they arrived.
 * Shown wherever the money is (home, a group, a settle-up screen) so nobody
 * has to find them in notifications.
 */
export function ConfirmPayments({ payments, nameOf, onDone }: {
  payments: Payment[]; nameOf: (memberId: string) => string; onDone: () => void;
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
      await api(`/v1/payments/${p.id}/confirm`, { body: {} });
      toast.show({ text: `Confirmed ${formatCents(p.amount_cents)} from ${nameOf(p.from_member_id)}` });
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
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} new` : 'Notifications'} onPress={() => router.push('/notifications' as Href)}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: HT.color.chipBorder, backgroundColor: HT.color.surface,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <BellIcon size={19} />
      {unread > 0 ? <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: HT.color.youOwe, borderWidth: 1.5, borderColor: '#fff' }} /> : null}
    </Pressable>
  );
}
