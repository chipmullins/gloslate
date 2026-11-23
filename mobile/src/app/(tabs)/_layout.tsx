import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupIcon } from '@/components/group-icons';
import { ActivityIcon, CalendarIcon, HouseIcon, PersonIcon } from '@/components/icons';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useSession } from '@/lib/session';

/** Home for the people you live with, Friends for one-on-one tabs and groups, then Activity, Bills, You. */
export default function TabsLayout() {
  const { wide, desktop } = useLayout();
  const { households } = useSession();
  // A badge on Friends while someone's payment is waiting for you to confirm it.
  const toConfirm = households.filter((h) => h.kind === 'group' && (h.to_confirm_cents ?? 0) > 0).length;
  // Sized from the real safe area so labels never sit under the iPhone's home indicator.
  const { bottom } = useSafeAreaInsets();
  // Wide screens put the label beside the icon, where the icon badge would sit on the word: show the count after it instead.
  const label = (title: string, badge?: number) => function TabLabel({ focused }: { focused: boolean }) { return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ fontFamily: focused ? HT.font.extrabold : HT.font.semibold, fontSize: 11.5, color: focused ? HT.color.brand : HT.color.muted }}>{title}</Text>
      {wide && badge ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: HT.color.youOwe, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: HT.font.bold, fontSize: 11, color: HT.color.onBrand }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  ); };
  return (
    <Tabs
      // The website on a computer: each tab draws the top navigation (WebTopNav) instead of this bar.
      tabBar={desktop ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: HT.color.brand,
        tabBarInactiveTintColor: HT.color.muted,
        tabBarStyle: { backgroundColor: HT.color.surface, borderTopColor: HT.color.hairline, height: (wide ? 64 : 58) + bottom, paddingBottom: bottom },
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 4 },
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        sceneStyle: { backgroundColor: HT.color.ground },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: label('Home'), tabBarIcon: ({ color }) => <HouseIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="groups" options={{ title: 'Friends', tabBarLabel: label('Friends', toConfirm), tabBarIcon: ({ color }) => <GroupIcon color={String(color)} size={22} />,
        tabBarBadge: (!wide && toConfirm) || undefined, tabBarAccessibilityLabel: toConfirm ? `Friends, ${toConfirm} to confirm` : 'Friends', tabBarBadgeStyle: { backgroundColor: HT.color.youOwe, color: HT.color.onBrand, fontFamily: HT.font.bold, fontSize: 11 } }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarLabel: label('Activity'), tabBarIcon: ({ color }) => <ActivityIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills', tabBarLabel: label('Bills'), tabBarIcon: ({ color }) => <CalendarIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarLabel: label('You'), tabBarIcon: ({ color }) => <PersonIcon color={String(color)} size={22} /> }} />
    </Tabs>
  );
}
