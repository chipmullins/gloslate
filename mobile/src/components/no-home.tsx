import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { GroupIcon } from '@/components/group-icons';
import { ChevronIcon, HouseIcon } from '@/components/icons';
import { Button, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';

/** True when you have a home (not just one-on-ones and groups). */
export function useHasHome() {
  const { households } = useSession();
  return households.some((h) => h.kind !== 'group');
}

/** "Set up your home": for people who started with friends only. Runs the existing /setup flow. */
export function SetUpHomeCard({ title = 'Live with people?', body = 'Set up your home to split rent, bills and groceries every month. Your friends and groups stay as they are.' }: { title?: string; body?: string }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <HouseIcon size={22} color={HT.color.brand} />
        </View>
        <T v="heading" style={{ flex: 1, fontSize: 17 }}>{title}</T>
      </View>
      <T v="muted">{body}</T>
      <Button title="Set up your home" onPress={() => router.push('/setup' as Href)} />
    </Card>
  );
}

/** A one-glance total across your one-on-ones and groups, tapping through to Friends. */
export function FriendsSummaryCard() {
  const { households } = useSession();
  const tabs = households.filter((h) => h.kind === 'group');
  const owed = tabs.reduce((s, h) => s + Math.max(0, h.balance.net_cents), 0);
  const owe = tabs.reduce((s, h) => s + Math.max(0, -h.balance.net_cents), 0);
  const waiting = tabs.filter((h) => (h.to_confirm_cents ?? 0) > 0).length;
  const square = owed === 0 && owe === 0;
  const label = square ? 'All square with your friends' : [owed ? `Owed to you ${formatCents(owed)}` : null, owe ? `You owe ${formatCents(owe)}` : null].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}${waiting ? `. ${waiting} waiting for you to confirm` : ''}. Open Friends.`}
      onPress={() => router.push('/groups' as Href)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card dark fireflies style={{ gap: 12, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <GroupIcon size={18} color={HT.color.darkCardMuted} />
          <T v="strong" style={{ flex: 1, color: HT.color.darkCardMuted, fontSize: 14 }}>With friends</T>
          <ChevronIcon size={16} color={HT.color.darkCardMuted} />
        </View>
        {square ? (
          <T v="heading" style={{ color: HT.color.onDarkText, fontSize: 20 }}>{tabs.length ? "You're all square" : 'Nobody owes anybody yet'}</T>
        ) : (
          <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
            {owed ? (
              <View style={{ gap: 2 }}>
                <T v="small" style={{ color: HT.color.darkCardMuted }}>Owed to you</T>
                <Money cents={owed} size={30} color={HT.color.onDarkOwed} />
              </View>
            ) : null}
            {owe ? (
              <View style={{ gap: 2 }}>
                <T v="small" style={{ color: HT.color.darkCardMuted }}>You owe</T>
                <Money cents={owe} size={30} color={HT.color.onDarkOwe} />
              </View>
            ) : null}
          </View>
        )}
        {waiting ? <T v="small" style={{ color: HT.color.glow }}>{waiting === 1 ? 'A payment is' : `${waiting} payments are`} waiting for you to confirm</T> : null}
      </Card>
    </Pressable>
  );
}
