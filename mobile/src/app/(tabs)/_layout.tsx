import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { ActivityIcon, CalendarIcon, HouseIcon, PersonIcon } from '@/components/icons';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';

/** Four tabs. Home is where almost all daily use happens. */
export default function TabsLayout() {
  const { wide } = useLayout();
  const label = (title: string) => function TabLabel({ focused }: { focused: boolean }) { return (
    <Text style={{ fontFamily: focused ? HT.font.extrabold : HT.font.semibold, fontSize: 11.5, color: focused ? HT.color.brand : HT.color.muted }}>{title}</Text>
  ); };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: HT.color.brand,
        tabBarInactiveTintColor: HT.color.muted,
        tabBarStyle: { backgroundColor: HT.color.surface, borderTopColor: HT.color.hairline, height: wide ? 64 : undefined },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        sceneStyle: { backgroundColor: HT.color.ground },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: label('Home'), tabBarIcon: ({ color }) => <HouseIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarLabel: label('Activity'), tabBarIcon: ({ color }) => <ActivityIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills', tabBarLabel: label('Bills'), tabBarIcon: ({ color }) => <CalendarIcon color={String(color)} size={22} /> }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarLabel: label('You'), tabBarIcon: ({ color }) => <PersonIcon color={String(color)} size={22} /> }} />
    </Tabs>
  );
}
