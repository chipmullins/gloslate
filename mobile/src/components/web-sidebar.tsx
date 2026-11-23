import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { GroupIcon } from '@/components/group-icons';
import { ActivityIcon, CalendarIcon, HouseIcon, HouseMark, PersonIcon, PlusIcon } from '@/components/icons';
import { T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { formatCents } from '@/lib/money';
import { useSession } from '@/lib/session';

const ICONS: Record<string, (p: { size?: number; color?: string }) => React.ReactNode> = {
  home: HouseIcon, groups: GroupIcon, activity: ActivityIcon, bills: CalendarIcon, you: PersonIcon,
};

/**
 * The website's sidebar (canvas "Gloslate · Web app redesign", A): replaces the
 * bottom tab bar on computer-sized windows. Same tabs, plus Add expense and
 * your tabs at a glance.
 */
export function WebSidebar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const { households } = useSession();
  const home = households.find((h) => h.kind !== 'group');
  const groups = households.filter((h) => h.kind === 'group').slice(0, 6);
  const goHome = () => { const r = state.routes.find((x) => x.name === 'home'); if (r) navigateToTab(r.key); };
  const toConfirm = households.filter((h) => h.kind === 'group' && (h.to_confirm_cents ?? 0) > 0).length;

  return (
    <View accessibilityRole="navigation" style={{ width: 264, backgroundColor: HT.color.surface, borderRightWidth: 1, borderRightColor: HT.color.hairline }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingVertical: 26, gap: 26 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Gloslate by Glofly, home" onPress={goHome}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }}>
          <HouseMark size={42} />
          <View>
            <T v="title" style={{ fontSize: 22, lineHeight: 24 }}><T style={{ color: HT.color.glowDeep, fontSize: 22 }}>glo</T>slate</T>
            <T v="small" style={{ fontSize: 12 }}>by Glofly</T>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Add an expense" onPress={() => router.push('/add' as Href)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ minHeight: 50, borderRadius: 16, backgroundColor: HT.color.brand,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: pressed ? 0.85 : hovered ? 0.93 : 1,
            shadowColor: HT.color.brand, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } })}>
          <PlusIcon size={18} color={HT.color.glow} />
          <T v="strong" style={{ color: HT.color.onBrand, fontSize: 15 }}>Add expense</T>
        </Pressable>

        <View style={{ gap: 4 }}>
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const title = descriptors[route.key]?.options.title ?? route.name;
            const Icon = ICONS[route.name] ?? HouseIcon;
            const badge = route.name === 'groups' ? toConfirm : 0;
            return (
              <Pressable key={route.key} accessibilityRole="link" accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${title}, ${badge} to confirm` : title}
                onPress={() => { if (!focused) navigateToTab(route.key); }}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46,
                  paddingHorizontal: 14, borderRadius: 14, backgroundColor: focused ? HT.color.brandTint : hovered ? HT.color.ground : 'transparent' })}>
                <Icon size={20} color={focused ? HT.color.brand : HT.color.muted} />
                <T style={{ flex: 1, fontSize: 15, fontFamily: focused ? HT.font.bold : HT.font.semibold, color: focused ? HT.color.brand : HT.color.ink }}>{title}</T>
                {badge ? (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: HT.color.youOwe, alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontFamily: HT.font.bold, fontSize: 12, color: HT.color.onBrand }}>{badge}</T>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 'auto', gap: 6 }}>
          <T v="label" style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4 }}>Your tabs</T>
          {home ? <TabLink name="Home" sub={home.people?.length ? `You & ${home.people.join(', ')}` : 'Just you'} cents={home.balance.net_cents} home
            active={state.routes[state.index]?.name === 'home'} onPress={goHome} /> : null}
          {groups.map((g) => (
            <TabLink key={g.id} name={(g.member_count <= 2 && g.people?.[0]) || g.name || (g.people ?? []).join(', ') || 'Tab'} sub={g.member_count > 2 ? `${g.member_count} people` : 'One-on-one'}
              cents={g.balance.net_cents} onPress={() => router.push(`/group/${g.id}` as Href)} />
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push('/group/new' as Href)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 10,
              borderRadius: 14, backgroundColor: hovered ? HT.color.ground : 'transparent' })}>
            <View style={{ width: 32, height: 32, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: HT.color.chipBorder, alignItems: 'center', justifyContent: 'center' }}>
              <PlusIcon size={14} color={HT.color.muted} />
            </View>
            <T v="strong" style={{ color: HT.color.muted, fontSize: 14 }}>New group or friend</T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function TabLink({ name, sub, cents, home, active, onPress }: { name: string; sub: string; cents: number; home?: boolean; active?: boolean; onPress: () => void }) {
  const amount = cents === 0 ? 'Square' : `${cents > 0 ? '+' : '−'}${formatCents(Math.abs(cents))}`;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${name}, ${cents === 0 ? 'square' : cents > 0 ? `you're owed ${formatCents(cents)}` : `you owe ${formatCents(-cents)}`}`} onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 10,
        borderRadius: 14, backgroundColor: active ? HT.color.brandTint : hovered ? HT.color.ground : 'transparent' })}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: home ? HT.color.brand : HT.color.segment, alignItems: 'center', justifyContent: 'center' }}>
        {home ? <HouseIcon size={16} color={HT.color.onBrand} /> : <GroupIcon size={16} color={HT.color.brand} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="strong" numberOfLines={1} style={{ fontSize: 14 }}>{name}</T>
        <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{sub}</T>
      </View>
      <T style={{ fontFamily: HT.font.monoBold, fontSize: 13, color: cents > 0 ? HT.color.owedToYou : cents < 0 ? HT.color.youOwe : HT.color.muted }}>{amount}</T>
    </Pressable>
  );
}
