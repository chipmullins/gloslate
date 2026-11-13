import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { ClockIcon } from '@/components/icons';
import { T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { formatCents } from '@/lib/money';
import { flush, onOutboxSynced, outbox, startOutbox, useOutbox } from '@/lib/outbox';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

/** Starts sending saved-offline expenses, and refreshes balances once they land. Mounted once. */
export function OutboxSync() {
  const { token, refresh } = useSession();
  useEffect(() => {
    if (!token) return;
    onOutboxSynced((n) => {
      refresh().catch(() => {});
      toast.show({ text: n === 1 ? 'Back online: your saved expense was added.' : `Back online: ${n} saved expenses were added.` });
    });
    startOutbox();
  }, [token, refresh]);
  return null;
}

/** What's waiting on this phone for a tab, with Retry / Discard for anything the server turned down. */
export function OutboxBanner({ householdId }: { householdId: string }) {
  const all = useOutbox();
  const mine = all.filter((i) => i.householdId === householdId);
  if (!mine.length) return null;
  const waiting = mine.filter((i) => !i.failed);
  const failed = mine.filter((i) => i.failed);
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: HT.color.surface, borderRadius: HT.radius.card, borderWidth: 1, borderColor: HT.color.hairline, padding: 14, gap: 10 }}>
      {waiting.length ? (
        <Pressable accessibilityRole="button" accessibilityHint="Tries to send them now" onPress={() => { flush().catch(() => {}); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <ClockIcon size={18} color={HT.color.brand} />
          <View style={{ flex: 1 }}>
            <T v="strong">{waiting.length === 1 ? '1 expense waiting to sync' : `${waiting.length} expenses waiting to sync`}</T>
            <T v="small" numberOfLines={2}>{waiting.map((i) => `${i.label} ${formatCents(i.amountCents)}`).join(' · ')}. Saved on this phone; added when you're back online.</T>
          </View>
        </Pressable>
      ) : null}
      {failed.map((i) => (
        <View key={i.clientId} style={{ gap: 6 }}>
          <T v="strong" style={{ color: HT.color.youOwe }}>Couldn't add {i.label} ({formatCents(i.amountCents)})</T>
          <T v="small">{i.failed}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Try adding ${i.label} again`} onPress={() => { outbox.retry(i.clientId).catch(() => {}); }}
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: HT.color.brandTint }}>
              <T v="strong" style={{ color: HT.color.brand, fontSize: 13.5 }}>Try again</T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Discard ${i.label}`} onPress={() => outbox.discard(i.clientId)}
              style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: 1, borderColor: HT.color.chipBorder }}>
              <T v="strong" style={{ fontSize: 13.5 }}>Discard</T>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
