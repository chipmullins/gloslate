import { router, type Href } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraIcon } from '@/components/icons';
import { SetUpHomeCard } from '@/components/no-home';
import { RowGroup, useMySettings, type RowItem } from '@/components/settings';
import { Avatar, Button, Card, ErrorNote, T } from '@/components/ui';
import { WebTopNav } from '@/components/web-top-nav';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { canMatchPhone, theme } from '@/lib/theme';

const STYLE_NAMES = { full: 'full screen', card: 'card', sheet: 'bottom sheet' } as const;
const TONE_NAMES: Record<string, string> = { gentle: 'Gentle', plain: 'Plain', cheeky: 'Cheeky' };

/** Settings (canvas "Settings: main"): a profile card, then one row per page. */
export default function You() {
  const { signOut } = useSession();
  const { user, home, homeId, me, error, run } = useMySettings();
  const { wide, gutter, desktop } = useLayout();
  if (!user) return <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} />;

  const handles = me ? [me.handles.venmo && `Venmo ${me.handles.venmo}`, me.handles.cashapp && `Cash App ${me.handles.cashapp}`, me.handles.zelle && 'Zelle'].filter(Boolean).join(' · ') : '';
  const prefs = user.notification_prefs ?? {};
  const offCount = Object.values(prefs).filter((v) => v === 'off').length;
  const themeName = theme.pref === 'system' && canMatchPhone ? 'Match phone' : theme.pref === 'dark' ? 'Dark mode' : 'Light mode';

  const top: RowItem[] = [
    { title: 'Payments', sub: handles || 'Add Venmo, Cash App or Zelle', href: '/settings/payments' },
    { title: 'Notifications', sub: offCount ? `${offCount} turned off · quiet hours, test` : 'What you get, quiet hours, test', href: '/settings/notifications' },
    { title: 'Reminders', sub: me ? `${me.auto_remind === false ? 'Nudges off' : 'Automatic nudges'} · ${TONE_NAMES[me.reminder_tone ?? 'plain'] ?? 'Plain'} tone` : 'Automatic nudges', href: '/settings/reminders' },
  ];
  const recapYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  const mid: RowItem[] = [
    { title: `Your ${recapYear}`, sub: 'Your year on the slate, ready to share', href: '/recap' },
    { title: 'Appearance', sub: `${themeName} · clean slate ${STYLE_NAMES[user.celebration_style ?? 'full']}`, href: '/settings/appearance' },
    ...(homeId && home ? [{ title: 'Home', sub: `${home.name} · statement on the ${home.statement_day}`, href: '/settings/home' }] : []),
    { title: 'Privacy & security', sub: 'Face ID, sign-in methods', href: '/settings/privacy' },
    { title: 'Your data', sub: 'Export a year or everything', href: '/settings/data' },
    { title: 'Help & legal', sub: 'Support, privacy, terms', href: '/settings/help' },
  ];

  function deleteAccount() {
    const go = () => run(async () => { await api('/v1/me', { method: 'DELETE', body: { confirm: 'DELETE' } }); await signOut(); router.replace('/welcome'); });
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete your account?', 'Your personal info is removed for good. Shared history stays, labeled "Former member", so everyone else\'s totals stay right.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  }

  const profile = (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={user.photo_url ? 'Change profile photo' : 'Add a profile photo'} onPress={() => router.push('/settings/profile' as Href)}>
        <Avatar name={user.first_name || '?'} size={60} photo={user.photo_url} />
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: HT.color.brand,
          borderWidth: 2, borderColor: HT.color.surface, alignItems: 'center', justifyContent: 'center' }}>
          <CameraIcon size={12} color={HT.color.onBrand} />
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <T v="title" numberOfLines={1}>{[user.first_name, user.last_name].filter(Boolean).join(' ')}</T>
        <T v="small" numberOfLines={1}>{handles || 'Add how people pay you'}</T>
      </View>
      <Button title="Edit" kind="link" onPress={() => router.push('/settings/profile' as Href)} />
    </Card>
  );

  const account = (
    <View style={{ gap: 4 }}>
      <Button title="Sign out" kind="secondary" onPress={async () => { await signOut(); router.replace('/welcome'); }} />
      <Button title="Delete account" kind="link" onPress={deleteAccount} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      {desktop ? <WebTopNav /> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: wide ? HT.maxWidth.content : HT.maxWidth.form, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 16 }}>
          <T v="display" accessibilityRole="header">You</T>
          <ErrorNote message={error} />
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 16 }}>{profile}<RowGroup rows={top} />{!homeId ? <SetUpHomeCard /> : null}</View>
              <View style={{ flex: 1, gap: 16 }}><RowGroup rows={mid} />{account}</View>
            </View>
          ) : (
            <>
              {profile}
              <RowGroup rows={top} />
              <RowGroup rows={mid} />
              {!homeId ? <SetUpHomeCard /> : null}
              {account}
            </>
          )}
          <T v="small" style={{ textAlign: 'center' }}>Gloslate by Glofly · Gloslate never holds or moves money.</T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
