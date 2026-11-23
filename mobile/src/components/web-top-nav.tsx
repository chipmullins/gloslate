import { router, useFocusEffect, usePathname, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { NotificationBell } from '@/components/confirm-payments';
import { HouseMark, PlusIcon } from '@/components/icons';
import { Avatar, NightSurface, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api } from '@/lib/api';
import { useLive } from '@/lib/live';
import { useSession } from '@/lib/session';

const TABS = [
  { href: '/home', label: 'Home' },
  { href: '/groups', label: 'Friends' },
  { href: '/activity', label: 'Activity' },
  { href: '/bills', label: 'Bills' },
] as const;

/** Width of the website's content column on a computer (nav, hero and cards line up on it). */
export const DESKTOP_MAX = 1200;

/**
 * The website's top navigation (canvas "Gloslate · Web app redesign", B): the logo,
 * pill tabs and your bell and avatar, sitting on the night sky. On a computer it
 * replaces the bottom tab bar. Home draws it inside its own sky (bare), other tabs
 * get a band of sky of their own.
 */
export function WebTopNav({ unread, bare, children }: { unread?: number; bare?: boolean; children?: ReactNode }) {
  const path = usePathname();
  // Home passes its own count; other tabs look it up so the bell badge shows everywhere.
  const [own, setOwn] = useState(0);
  useFocusEffect(useCallback(() => {
    if (unread !== undefined) return;
    api<{ unread: number }>('/v1/pulse').then((r) => setOwn(r.unread)).catch(() => {});
  }, [unread]));
  useLive(({ unread: n }) => setOwn(n));
  const count = unread ?? own;
  const { user, households } = useSession();
  const toConfirm = households.filter((h) => h.kind === 'group' && (h.to_confirm_cents ?? 0) > 0).length;
  const onYou = path.startsWith('/you') || path.startsWith('/settings');

  const bar = (
    <View accessibilityRole="navigation" style={{ width: '100%', maxWidth: DESKTOP_MAX, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 20,
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Gloslate by Glofly, home" onPress={() => router.navigate('/home' as Href)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <HouseMark size={40} inverted />
        <T style={{ fontFamily: HT.font.displayBold, fontSize: 22, color: HT.color.onDarkText }}><T style={{ fontFamily: HT.font.displayBold, fontSize: 22, color: HT.color.glow }}>glo</T>slate</T>
      </Pressable>

      <View style={{ flexGrow: 1, flexBasis: 360, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: HT.color.onDarkButton, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
          {TABS.map((t) => {
            const on = path === t.href || path.startsWith(`${t.href}/`) || (t.href === '/groups' && (path.startsWith('/group') || path.startsWith('/people')));
            const badge = t.href === '/groups' ? toConfirm : 0;
            return (
              <Pressable key={t.href} accessibilityRole="link" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${t.label}, ${badge} to confirm` : t.label}
                onPress={() => router.navigate(t.href as Href)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ minHeight: 42, paddingHorizontal: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: on ? HT.color.onDarkText : hovered ? 'rgba(255,255,255,0.08)' : 'transparent' })}>
                <T style={{ fontFamily: HT.font.bold, fontSize: 15, color: on ? '#241A23' : HT.color.darkCardMuted }}>{t.label}</T>
                {badge ? (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: HT.color.onDarkOwe, alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontFamily: HT.font.bold, fontSize: 11, color: '#241A23' }}>{badge}</T>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add an expense" onPress={() => router.push('/add' as Href)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ height: 44, paddingHorizontal: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: HT.color.onDarkButton, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', opacity: pressed ? 0.8 : hovered ? 0.92 : 1 })}>
          <PlusIcon size={16} color={HT.color.glow} />
          <T style={{ fontFamily: HT.font.bold, fontSize: 15, color: HT.color.onDarkText }}>Add</T>
        </Pressable>
        <NotificationBell unread={count} onDark />
        <Pressable accessibilityRole="link" accessibilityLabel="You and settings" onPress={() => router.navigate('/you' as Href)}
          style={{ borderRadius: 24, borderWidth: 2, borderColor: onYou ? HT.color.glow : 'transparent', padding: 1 }}>
          <Avatar name={user?.first_name || '?'} size={40} photo={user?.photo_url} />
        </Pressable>
      </View>
    </View>
  );

  if (bare) return <>{bar}{children}</>;
  return <NightSurface fireflies>{bar}{children}</NightSurface>;
}
