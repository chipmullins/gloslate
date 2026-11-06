import type React from 'react';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupIcon } from '@/components/group-icons';
import { CheckIcon, HouseIcon, SendIcon } from '@/components/icons';
import { Avatar, Button, Card, Money, T } from '@/components/ui';
import { HT } from '@/constants/theme';

/** A tiny mock row for the illustrations. */
function MockRow({ title, sub, caption, cents, owed }: { title: string; sub: string; caption: string; cents: number; owed: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <T v="strong" style={{ fontSize: 14 }}>{title}</T>
        <T v="small">{sub}</T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T v="small" style={{ color: owed ? HT.color.owedToYou : HT.color.youOwe }}>{caption}</T>
        <Money cents={cents} size={15} color={owed ? HT.color.owedToYou : HT.color.youOwe} />
      </View>
    </View>
  );
}

const PAGES = [
  {
    key: 'home',
    title: 'Keep a running tab at home',
    body: 'Rent, utilities, groceries. Add what you paid and Gloslate keeps track of who owes who, with a statement every month.',
    art: (
      <Card style={{ gap: 2, paddingVertical: 10 }}>
        <MockRow title="Electric" sub="You paid $142.80" caption="Coleman owes you" cents={7140} owed />
        <View style={{ height: 1, backgroundColor: HT.color.hairline }} />
        <MockRow title="Groceries" sub="Coleman paid $46.30" caption="You owe Coleman" cents={2315} owed={false} />
      </Card>
    ),
  },
  {
    key: 'friend',
    title: 'Or just say "you owe me"',
    body: 'Covered lunch for a co-worker? Send them a request with the amount and how to pay you. They don\'t need the app.',
    art: (
      <Card dark style={{ alignItems: 'center', gap: 8, paddingVertical: 22 }}>
        <Avatar name="Jordan" index={2} />
        <T v="strong" style={{ color: HT.color.darkCardMuted }}>Jordan owes you</T>
        <Money cents={1850} size={40} color={HT.color.onDarkOwed} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SendIcon size={14} color={HT.color.darkCardMuted} />
          <T v="small" style={{ color: HT.color.darkCardMuted }}>Request sent with a Venmo link</T>
        </View>
      </Card>
    ),
  },
  {
    key: 'group',
    title: 'Trips and groups add up for you',
    body: 'Everyone adds what they paid, even when two people split the hotel. Gloslate finds the fewest payments to settle everyone.',
    art: (
      <Card style={{ gap: 10 }}>
        {[['Ana', 'Chip', 4000], ['Ben', 'Chip', 2250]].map(([a, b, c]) => (
          <View key={String(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={String(a)} index={a === 'Ana' ? 1 : 4} size={30} />
            <T v="strong" style={{ flex: 1, fontSize: 14 }}>{a} pays {b}</T>
            <Money cents={Number(c)} size={15} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CheckIcon size={14} color={HT.color.owedToYou} />
          <T v="small">2 payments settle all 4 people</T>
        </View>
      </Card>
    ),
  },
];

/** First run: how Gloslate works, then pick how to start. */
export default function Onboarding() {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 560);
  const [page, setPage] = useState(0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const last = page >= PAGES.length;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  const go = (i: number) => scroller.current?.scrollTo({ x: i * pageWidth, animated: true });

  const choices = (
    <View style={{ width: pageWidth, paddingHorizontal: 24, justifyContent: 'center', gap: 14 }}>
      <T v="display" accessibilityRole="header">How do you want to start?</T>
      <T v="muted">You can do all three. This just picks where to begin.</T>
      {[
        { icon: <HouseIcon size={22} color={HT.color.brand} />, title: 'I live with people', sub: 'Set up your home', to: '/setup' },
        { icon: <SendIcon size={20} color={HT.color.brand} />, title: 'Settle up with someone', sub: 'One person owes the other', to: '/request-friend' },
        { icon: <GroupIcon size={22} color={HT.color.brand} />, title: 'A trip or a group', sub: 'Split it between friends', to: '/group/new' },
      ].map((c) => (
        <Pressable key={c.to} accessibilityRole="button" accessibilityLabel={`${c.title}. ${c.sub}`} onPress={() => router.push(c.to as Href)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingHorizontal: 16, borderRadius: HT.radius.card,
            backgroundColor: HT.color.surface, borderWidth: 1, borderColor: HT.color.hairline, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ width: 44, height: 44, borderRadius: HT.radius.tile, backgroundColor: HT.color.brandTint, alignItems: 'center', justifyContent: 'center' }}>{c.icon}</View>
          <View style={{ flex: 1 }}>
            <T v="strong">{c.title}</T>
            <T v="small">{c.sub}</T>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, width: pageWidth, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', minHeight: 48, paddingHorizontal: 12 }}>
          {!last ? <Button kind="link" title="Skip" onPress={() => go(PAGES.length)} /> : null}
        </View>
        <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
          {PAGES.map((p) => (
            <View key={p.key} style={{ width: pageWidth, paddingHorizontal: 24, justifyContent: 'center', gap: 22 }}>
              {p.art}
              <View style={{ gap: 10 }}>
                <T v="display" accessibilityRole="header">{p.title}</T>
                <T v="muted" style={{ fontSize: 16, lineHeight: 23 }}>{p.body}</T>
              </View>
            </View>
          ))}
          {choices}
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityLabel={`Page ${page + 1} of ${PAGES.length + 1}`}>
            {[...PAGES, null].map((_, i) => (
              <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? HT.color.brand : HT.color.chipBorder }} />
            ))}
          </View>
          {!last ? <Button title={page === PAGES.length - 1 ? 'Get started' : 'Next'} onPress={() => go(page + 1)} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
