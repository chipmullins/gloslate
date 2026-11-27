import { Tabs } from 'expo-router';

import { GroupIcon } from '@/components/group-icons';
import { ActivityIcon, CalendarIcon, HouseIcon, PersonIcon } from '@/components/icons';
import { PillTabBar, type PillTab } from '@/components/pill-tab-bar';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useSession } from '@/lib/session';

/** Home for the people you live with, Friends for one-on-one tabs and groups, then Activity, Bills, You.
 *  Phones and tablets get the floating pill bar; the website on a computer draws WebTopNav instead. */
export default function TabsLayout() {
  const { desktop } = useLayout();
  const { households } = useSession();
  // A badge on Friends while someone's payment is waiting for you to confirm it.
  const toConfirm = households.filter((h) => h.kind === 'group' && (h.to_confirm_cents ?? 0) > 0).length;
  const tabs: PillTab[] = [
    { name: 'home', title: 'Home', icon: (c) => <HouseIcon color={c} size={22} /> },
    { name: 'groups', title: 'Friends', icon: (c) => <GroupIcon color={c} size={22} />, badge: toConfirm || undefined,
      a11y: toConfirm ? `Friends, ${toConfirm} to confirm` : 'Friends' },
    { name: 'activity', title: 'Activity', icon: (c) => <ActivityIcon color={c} size={22} /> },
    { name: 'bills', title: 'Bills', icon: (c) => <CalendarIcon color={c} size={22} /> },
    { name: 'you', title: 'You', icon: (c) => <PersonIcon color={c} size={22} /> },
  ];
  return (
    <Tabs
      tabBar={desktop ? () => null : (props) => <PillTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: HT.color.ground } }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="groups" options={{ title: 'Friends' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
