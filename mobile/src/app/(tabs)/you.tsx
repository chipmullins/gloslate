import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronIcon, DownloadIcon } from '@/components/icons';
import { ordinal, Stepper } from '@/components/stepper';
import { Avatar, Button, Card, ErrorNote, Field, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Household, type Member } from '@/lib/api';
import { downloadAndShare } from '@/lib/files';
import { prettyPhone } from '@/lib/phone';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

const PREF_KINDS = [
  { key: 'expense_added', label: 'Expenses that include you' },
  { key: 'bill_posted', label: 'Bills posting with your share' },
  { key: 'payment_confirmed', label: 'Your payments confirmed' },
  { key: 'statement_ready', label: 'Monthly statement ready' },
] as const;
const hour = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="heading" accessibilityRole="header">{title}</T>
      <Card style={{ gap: 14 }}>{children}</Card>
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1 }}>
        <T v="strong">{label}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: HT.color.brand, false: HT.color.chipBorder }} thumbColor="#FFFFFF" />
    </View>
  );
}

export default function You() {
  const { user, households, refresh, signOut } = useSession();
  const { wide, gutter } = useLayout();
  // Your home if you have one; otherwise any tab you're in (payment apps and
  // reminders are saved to every tab, so any one shows the current values).
  const homeId = households.find((h) => h.kind !== 'group')?.id;
  const id = homeId ?? households[0]?.id;
  const [home, setHome] = useState<Household | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [venmo, setVenmo] = useState('');
  const [cashtag, setCashtag] = useState('');
  const [zelle, setZelle] = useState('');
  const [threshold, setThreshold] = useState('');
  const [homeName, setHomeName] = useState('');
  const [biometrics, setBiometrics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await api<{ data: Household }>(`/v1/households/${id}`);
    setHome(r.data);
    setMe(r.data.me);
    setHomeName(r.data.name);
    setVenmo(r.data.me.handles.venmo ?? '');
    setCashtag(r.data.me.handles.cashapp ?? '');
    setZelle(r.data.me.handles.zelle ?? '');
    setThreshold(centsFirst(String(r.data.me.remind_threshold_cents ?? 4000)));
  }, [id]);
  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(([h, e]) => setBiometrics(h && e)).catch(() => {});
  }, []);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    try {
      await fn();
      if (done) toast.show({ text: done });
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }
  const patchMe = (body: object, done?: string) => run(() => api('/v1/me', { method: 'PATCH', body }), done);
  /** Payment apps and reminders: saved to every tab you're in. */
  const patchMine = (body: object, done?: string) => patchMe({ member: body }, done);
  const patchHome = (body: object, done?: string) => run(() => api(`/v1/households/${id}`, { method: 'PATCH', body }), done);

  function confirm(title: string, message: string, action: string, go: () => void) {
    if (Platform.OS === 'web') return go();
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: go }]);
  }

  function removeMember(m: Member) {
    const owes = home?.balance.with.find((w) => w.member_id === m.id);
    const go = (forgive: boolean) => run(() => api(`/v1/households/${id}/members/${m.id}${forgive ? '?forgive=true' : ''}`, { method: 'DELETE' }), `${m.first_name} moved out`);
    if (owes && owes.cents !== 0 && Platform.OS !== 'web') {
      Alert.alert(`${m.first_name} has an open balance`, `Settle up first, or forgive ${formatCents(Math.abs(owes.cents))}. Forgiving is logged for everyone.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Forgive and remove', style: 'destructive', onPress: () => go(true) },
      ]);
    } else confirm(`Remove ${m.first_name}?`, 'Their past expenses stay in the history.', 'Remove', () => go(false));
  }

  function deleteAccount() {
    confirm('Delete your account?', 'Your personal info is removed for good. Shared history stays, labeled "Former member", so everyone else\'s totals stay right.', 'Delete', () =>
      run(async () => { await api('/v1/me', { method: 'DELETE', body: { confirm: 'DELETE' } }); await signOut(); router.replace('/welcome'); }));
  }

  if (!user) return <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} />;
  const isHome = !!home && home.kind !== 'group';
  const prefs = user.notification_prefs ?? {};
  const roommates = isHome && home ? home.members.filter((m) => !m.you && !m.former) : [];

  const left = (
    <>
      <Section title="You">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user.first_name || '?'} index={home ? home.members.findIndex((m) => m.you) : 0} size={52} />
          <View style={{ flex: 1 }}>
            <T v="strong">{user.first_name}</T>
            <T v="small">{[user.phone ? prettyPhone(user.phone) : null, user.email].filter(Boolean).join(' · ')}</T>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign-in methods" onPress={() => router.push('/sign-in-methods' as Href)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: HT.radius.tile,
            borderWidth: 1, borderColor: HT.color.hairline, backgroundColor: HT.color.ground, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flex: 1 }}>
            <T v="strong">Sign-in methods</T>
            <T v="small" numberOfLines={1}>{user.identities.map((i) => ({ email: 'Email', phone: 'Phone', apple: 'Apple', google: 'Google', glofly: 'Glofly' } as Record<string, string>)[i.provider] ?? i.provider).join(' · ')}</T>
          </View>
          <T v="strong" style={{ color: HT.color.brand, fontSize: 13 }}>Manage</T>
          <ChevronIcon size={16} color={HT.color.muted} />
        </Pressable>
        <Field label="First name" value={firstName} onChangeText={setFirstName} onEndEditing={() => firstName.trim() && firstName !== user.first_name && patchMe({ first_name: firstName.trim() }, 'Saved')} />
      </Section>

      <Section title="How people pay you">
        <Field label="Venmo username" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} placeholder="@your-name" />
        <Field label="Cash App $cashtag" value={cashtag} onChangeText={setCashtag} autoCapitalize="none" autoCorrect={false} placeholder="$you" />
        <Field label="Zelle email or phone" value={zelle} onChangeText={setZelle} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Button title="Save payment apps" kind="secondary" onPress={() => patchMine({ venmo_handle: venmo, cashtag, zelle_contact: zelle }, 'Payment apps saved')} />
        <T v="small">Used for your home, one-on-ones and groups.</T>
      </Section>

      {me ? <Section title="Reminders">
        <Toggle label="Let Gloslate nudge people for you" hint="So nobody has to be the bad guy" value={me.auto_remind ?? true} onChange={(v) => patchMine({ auto_remind: v })} />
        {me.auto_remind !== false ? (
          <>
            <Field label="When someone owes you at least" value={threshold} onChangeText={(t) => setThreshold(centsFirst(t))} keyboardType="number-pad"
              onEndEditing={() => { const c = parseCents(threshold); if (c) patchMine({ remind_threshold_cents: c }, 'Saved'); }} />
            <Stepper label="Or it's been this long" value={me.remind_after_days ?? 7} min={1} max={30} onChange={(v) => patchMine({ remind_after_days: v })} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
            <T v="small">At most one nudge every 3 days, never during quiet hours, and it stops the moment a payment is marked.</T>
          </>
        ) : null}
      </Section> : null}
    </>
  );

  const right = (
    <>
      <Section title="Notifications">
        {PREF_KINDS.map((k) => {
          const value = prefs[k.key] ?? 'on';
          return (
            <View key={k.key} style={{ gap: 6 }}>
              <T v="strong">{k.label}</T>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: 12, padding: 3, gap: 3 }}>
                {(['on', 'daily', 'off'] as const).map((v) => (
                  <Pressable key={v} accessibilityRole="radio" accessibilityLabel={`${k.label}: ${v}`} accessibilityState={{ checked: value === v }}
                    onPress={() => patchMe({ notification_prefs: { [k.key]: v } })}
                    style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: value === v ? HT.color.surface : 'transparent' }}>
                    <T v="strong" style={{ fontSize: 13, color: value === v ? HT.color.ink : HT.color.muted }}>{v === 'on' ? 'Right away' : v === 'daily' ? 'Daily' : 'Off'}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}><Stepper label="Quiet from" value={user.quiet_start_hour} min={0} max={23} onChange={(v) => patchMe({ quiet_start_hour: v })} format={hour} /></View>
          <View style={{ flex: 1 }}><Stepper label="Until" value={user.quiet_end_hour} min={0} max={23} onChange={(v) => patchMe({ quiet_end_hour: v })} format={hour} /></View>
        </View>
        <T v="small">Requests, payments marked, and bill amounts needed always come through, just not during quiet hours.</T>
      </Section>

      {biometrics ? (
        <Section title="Security">
          <Toggle label="Lock with Face ID" hint="Asks when you open Gloslate" value={user.face_id_lock}
            onChange={async (v) => {
              const ok = v ? (await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on Face ID lock' })).success : true;
              if (ok) patchMe({ face_id_lock: v }, v ? 'Gloslate will ask for Face ID' : 'Face ID lock off');
            }} />
        </Section>
      ) : null}

      {isHome && home ? <Section title="Home">
        <Field label="Name" value={homeName} onChangeText={setHomeName} onEndEditing={() => homeName.trim() && homeName !== home.name && patchHome({ name: homeName.trim() }, 'Saved. Everyone sees the change.')} />
        <Stepper label="Monthly statement on the" value={home.statement_day} min={1} max={28} onChange={(v) => patchHome({ statement_day: v })} format={ordinal} />
        {home.members.filter((m) => !m.former).length > 2 ? (
          <Toggle label="Simplify debts" hint="Fewest transfers to settle the whole house" value={home.simplify_debts} onChange={(v) => patchHome({ simplify_debts: v })} />
        ) : null}
        <View style={{ gap: 4 }}>
          <T v="label">People</T>
          {roommates.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
              <Avatar name={m.first_name} index={home.members.indexOf(m)} size={34} />
              <View style={{ flex: 1 }}>
                <T v="strong">{m.display_name}</T>
                <T v="small">{m.placeholder ? 'Not joined yet' : m.moved_out_on ? `Moving out ${m.moved_out_on}` : m.moved_in_on ? `Moved in ${m.moved_in_on}` : 'Lives here'}</T>
              </View>
              <Button title="Remove" kind="link" onPress={() => removeMember(m)} />
            </View>
          ))}
          <T v="small">Any change here is logged and shown to everyone.</T>
        </View>
      </Section> : null}

      <Section title="Account">
        <Button title="Export my data" kind="secondary" icon={<DownloadIcon size={18} />}
          onPress={() => downloadAndShare('/v1/me/export', 'gloslate-my-data.json', 'application/json').catch(() => setError("Couldn't export."))} />
        {isHome ? <Button title="Export this year (CSV)" kind="secondary" icon={<DownloadIcon size={18} />}
          onPress={() => downloadAndShare(`/v1/households/${id}/export?year=${new Date().getFullYear()}`, `Gloslate-${new Date().getFullYear()}.csv`, 'text/csv').catch(() => setError("Couldn't export."))} /> : null}
        <Button title="Sign out" kind="secondary" onPress={async () => { await signOut(); router.replace('/welcome'); }} />
        {isHome && me ? <Button title="Leave this home" kind="link" onPress={() => removeMember({ ...me, first_name: 'You' } as Member)} /> : null}
        <Button title="Delete my account" kind="link" onPress={deleteAccount} />
      </Section>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 18 }}>
          <T v="display" accessibilityRole="header">Settings</T>
          <ErrorNote message={error} />
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 18 }}>{left}</View>
              <View style={{ flex: 1, gap: 18 }}>{right}</View>
            </View>
          ) : (
            <>{left}{right}</>
          )}
          <T v="small" style={{ textAlign: 'center' }}>Gloslate by Glofly · Gloslate never holds or moves money.</T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
