import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';

/**
 * The night "where you stand" card (canvas "Gloslate · Pill bar redesign", Settle up): an amber caps
 * label and the person on top, the amount big, then both of you and a note. Fireflies kept.
 */
export function StatCard({ net, name, sub, me, them, note, children }: {
  net: number; name: string; sub?: string;
  me?: { name: string; photo?: string | null }; them: { name: string; photo?: string | null; index?: number };
  note?: string; children?: ReactNode;
}) {
  const label = net > 0 ? 'Owes you' : net < 0 ? 'You owe' : 'All square';
  return (
    <Card dark fireflies style={{ gap: 4, paddingTop: 22, paddingBottom: 20, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <T style={{ fontFamily: HT.font.label, fontSize: 12, letterSpacing: 2.2, color: HT.color.glow, textTransform: 'uppercase', marginTop: 4 }}>{label}</T>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <T numberOfLines={1} style={{ fontFamily: HT.font.displayExtra, fontSize: 20, lineHeight: 25, color: HT.color.onDarkText }}>{name}</T>
          {sub ? <T numberOfLines={1} style={{ fontFamily: HT.font.medium, fontSize: 13, color: HT.color.darkCardMuted }}>{sub}</T> : null}
        </View>
      </View>
      <Money cents={Math.abs(net)} size={60} color={net > 0 ? HT.color.onDarkOwed : net < 0 ? HT.color.onDarkOwe : HT.color.onDarkText} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          {me ? (
            <View style={{ borderRadius: 19, borderWidth: 2, borderColor: HT.color.night.base }}>
              <Avatar name={me.name} photo={me.photo} index={3} size={34} />
            </View>
          ) : null}
          <View style={{ borderRadius: 19, borderWidth: 2, borderColor: HT.color.night.base, marginLeft: me ? -8 : 0 }}>
            <Avatar name={them.name} photo={them.photo} index={them.index ?? 1} size={34} />
          </View>
        </View>
        {note ? <T style={{ fontFamily: HT.font.medium, fontSize: 13.5, color: HT.color.darkCardMuted, flexShrink: 1, textAlign: 'right' }}>{note}</T> : null}
      </View>
      {children}
    </Card>
  );
}

/** The round white back / action button from the mockups' top row. */
export function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}
