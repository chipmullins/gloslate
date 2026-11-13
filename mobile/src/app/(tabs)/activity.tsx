import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/expense-row';
import { ChevronIcon, SearchIcon } from '@/components/icons';
import { Button, Card, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { api, CATEGORIES, type Expense, type Household, type StatementSummary } from '@/lib/api';
import { useSession } from '@/lib/session';

/** History (searchable by item, person, category) and monthly statements. */
export default function Activity() {
  const { households } = useSession();
  const { wide, gutter } = useLayout();
  const id = households.find((h) => h.kind !== 'group')?.id;
  const [home, setHome] = useState<Household | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [items, setItems] = useState<Expense[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  // Home: this home's history and statements. Everyone: the home plus every group.
  const [scope, setScope] = useState<'home' | 'all'>(id ? 'home' : 'all');
  const [all, setAll] = useState<{ e: Expense; place: Household }[] | null>(null);
  const hasGroups = households.some((h) => h.kind === 'group');

  const searchAll = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    const places = await Promise.all(households.map((h) => api<{ data: Household }>(`/v1/households/${h.id}`).then((r) => r.data).catch(() => null)));
    const lists = await Promise.all(places.map((place) => (place
      ? api<{ data: Expense[] }>(`/v1/households/${place.id}/history?${params}`).then((r) => r.data.map((e) => ({ e, place }))).catch(() => [])
      : Promise.resolve([]))));
    setAll(lists.flat().sort((a, b) => (a.e.created_at < b.e.created_at ? 1 : -1)).slice(0, 80));
  }, [households, q, category]);

  const search = useCallback(async (before?: string) => {
    if (!id) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (person) params.set('member_id', person);
    if (before) params.set('before', before);
    const r = await api<{ data: Expense[]; meta: { next_before: string | null } }>(`/v1/households/${id}/history?${params}`);
    setItems((cur) => (before ? [...cur, ...r.data] : r.data));
    setNext(r.meta.next_before);
  }, [id, q, category, person]);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    api<{ data: Household }>(`/v1/households/${id}`).then((r) => setHome(r.data)).catch(() => {});
    api<{ data: StatementSummary[] }>(`/v1/households/${id}/statements`).then((r) => setStatements(r.data)).catch(() => {});
  }, [id]));
  useEffect(() => {
    const t = setTimeout(() => { (scope === 'all' ? searchAll() : search()).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [scope, search, searchAll]);

  const chip = (on: boolean) => ({ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' as const, borderWidth: on ? 1.5 : 1,
    borderColor: on ? HT.color.brand : HT.color.chipBorder, backgroundColor: on ? HT.color.brandTint : HT.color.surface });

  const statementList = (
    <View style={{ gap: 8 }}>
      <T v="heading">Statements</T>
      <Card style={{ paddingVertical: 4 }}>
        {statements.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>Your first statement arrives on the 1st. It's a record, not a deadline.</T> : null}
        {statements.map((s, i) => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/statements/${s.id}` as Href)}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 12, borderBottomWidth: i < statements.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <View style={{ flex: 1 }}>
              <T v="strong">{s.title}</T>
              <T v="small">{s.summary}</T>
            </View>
            <ChevronIcon size={18} color={HT.color.muted} />
          </Pressable>
        ))}
      </Card>
    </View>
  );

  const history = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: HT.color.surface, borderRadius: HT.radius.tile, borderWidth: 1, borderColor: HT.color.chipBorder, paddingHorizontal: 14 }}>
        <SearchIcon size={18} color={HT.color.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search items" placeholderTextColor={HT.color.faint} accessibilityLabel="Search items" returnKeyType="search"
          style={{ flex: 1, height: 48, paddingVertical: 0, fontFamily: HT.font.semibold, fontSize: 15.5, color: HT.color.ink }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(scope === 'home' ? home?.members ?? [] : []).filter((m) => !m.former).map((m) => (
          <Pressable key={m.id} accessibilityRole="button" accessibilityState={{ selected: person === m.id }} onPress={() => setPerson(person === m.id ? null : m.id)} style={chip(person === m.id)}>
            <T v="strong" style={{ fontSize: 13, color: person === m.id ? HT.color.brand : HT.color.ink }}>{m.you ? 'You' : m.first_name}</T>
          </Pressable>
        ))}
        <View style={{ width: 1, backgroundColor: HT.color.hairline, marginHorizontal: 4 }} />
        {CATEGORIES.map((c) => (
          <Pressable key={c.key} accessibilityRole="button" accessibilityState={{ selected: category === c.key }} onPress={() => setCategory(category === c.key ? null : c.key)} style={chip(category === c.key)}>
            <T v="strong" style={{ fontSize: 13, color: category === c.key ? HT.color.brand : HT.color.ink }}>{c.label}</T>
          </Pressable>
        ))}
      </ScrollView>
      {scope === 'all' ? (
        <Card style={{ paddingVertical: 4 }}>
          {all?.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>{q || category ? 'Nothing matches' : 'Nothing logged yet'}</T> : null}
          {(all ?? []).map(({ e, place }, i) => (
            <View key={e.id}>
              <T v="small" style={{ paddingTop: 10, color: HT.color.brand }}>{place.name}</T>
              <ExpenseRow e={e} members={place.members} last={i === (all?.length ?? 0) - 1} onPress={() => router.push(`/expense/${e.id}` as Href)} />
            </View>
          ))}
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {items.length === 0 ? <T v="muted" style={{ paddingVertical: 16, textAlign: 'center' }}>{q || category || person ? 'Nothing matches' : 'Nothing logged yet'}</T> : null}
          {items.map((e, i) => <ExpenseRow key={e.id} e={e} members={home?.members ?? []} last={i === items.length - 1} onPress={() => router.push(`/expense/${e.id}` as Href)} />)}
        </Card>
      )}
      {scope === 'home' && next ? <Button title="Show older" kind="secondary" onPress={() => search(next)} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HT.color.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: HT.maxWidth.content, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 18 }}>
          <T v="display" accessibilityRole="header">Activity</T>
          {id && hasGroups ? (
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 4, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
              {(['home', 'all'] as const).map((k) => (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: scope === k }} onPress={() => setScope(k)}
                  style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: scope === k ? HT.color.surface : 'transparent' }}>
                  <T v="strong" style={{ fontSize: 14, color: scope === k ? HT.color.ink : HT.color.muted }}>{k === 'home' ? 'Home' : 'Everyone'}</T>
                </Pressable>
              ))}
            </View>
          ) : null}
          {scope === 'all' ? history : wide ? (
            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 6 }}>{history}</View>
              <View style={{ flex: 4 }}>{statementList}</View>
            </View>
          ) : (
            <>{statementList}{history}</>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
