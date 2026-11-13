import { router, useFocusEffect, type Href } from 'expo-router';
import { Fragment, useCallback, useState, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { BackIcon, ChevronIcon } from '@/components/icons';
import { Card, ErrorNote, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type Household, type Member } from '@/lib/api';
import { goBack } from '@/lib/nav';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

/** A settings sub-page: back to You, a title, then its sections. */
export function SettingsPage({ title, error, children }: { title: string; error?: string | null; children: ReactNode }) {
  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }}>
        <IconButton label="Back" onPress={() => goBack('/you' as Href)}><BackIcon /></IconButton>
        <T v="heading" accessibilityRole="header" style={{ fontSize: 18 }}>{title}</T>
      </View>
      <View style={{ gap: 18, paddingTop: 4 }}>
        <ErrorNote message={error ?? null} />
        {children}
      </View>
    </Screen>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <T v="label" accessibilityRole="header" style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 4 }}>{title}</T> : null}
      <Card style={{ gap: 14 }}>{children}</Card>
    </View>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
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

export type RowItem = { title: string; sub?: string; href: string };

/** A card of rows that each open a sub-page (title, one-line summary, chevron). */
export function RowGroup({ rows }: { rows: RowItem[] }) {
  return (
    <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
      {rows.map((r, i) => (
        <Fragment key={r.href}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: HT.color.hairline, marginLeft: 18 }} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={r.sub ? `${r.title}. ${r.sub}` : r.title} onPress={() => router.push(r.href as Href)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 18, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flex: 1 }}>
              <T v="strong">{r.title}</T>
              {r.sub ? <T v="small" numberOfLines={1}>{r.sub}</T> : null}
            </View>
            <ChevronIcon size={16} color={HT.color.muted} />
          </Pressable>
        </Fragment>
      ))}
    </Card>
  );
}

/**
 * Your settings that live on each tab you're in (payment apps, reminders): read from your
 * home if you have one, otherwise any tab. Saving writes them to every tab.
 */
export function useMySettings() {
  const { user, households, refresh } = useSession();
  const homeId = households.find((h) => h.kind !== 'group')?.id;
  const id = homeId ?? households[0]?.id;
  const [home, setHome] = useState<Household | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await api<{ data: Household }>(`/v1/households/${id}`);
    setHome(r.data);
    setMe(r.data.me);
  }, [id]);
  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  async function run(fn: () => Promise<unknown>, done?: string) {
    setError(null);
    try {
      await fn();
      if (done) toast.show({ text: done });
      await Promise.all([load(), refresh()]);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      return false;
    }
  }
  const patchMe = (body: object, done?: string) => run(() => api('/v1/me', { method: 'PATCH', body }), done);
  const patchMine = (body: object, done?: string) => patchMe({ member: body }, done);
  const patchHome = (body: object, done?: string) => run(() => api(`/v1/households/${id}`, { method: 'PATCH', body }), done);

  return { user, households, homeId, id, home, me, error, setError, run, patchMe, patchMine, patchHome, refresh };
}

/** One segmented choice (Right away / Daily / Off, Match phone / Light / Dark). */
export function Segmented<K extends string>({ label, value, options, onChange }: {
  label: string; value: K; options: { key: K; label: string }[]; onChange: (k: K) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: 12, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="radio" accessibilityLabel={`${label}: ${o.label}`} accessibilityState={{ checked: on }} onPress={() => { if (!on) onChange(o.key); }}
            style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? HT.color.surface : 'transparent' }}>
            <T v="strong" style={{ fontSize: 13, color: on ? HT.color.ink : HT.color.muted }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
