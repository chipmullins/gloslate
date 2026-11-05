import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { ordinal, Stepper } from '@/components/stepper';
import { Avatar, Button, ErrorNote, Field, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, type Bill } from '@/lib/api';
import { centsFirst, formatCents, parseCents } from '@/lib/money';
import { toast } from '@/lib/toast';

const PRESETS = [
  { name: 'Rent', kind: 'fixed', category: 'rent', due_day: 1 },
  { name: 'Electric', kind: 'variable', category: 'utilities', due_day: 15 },
  { name: 'Water', kind: 'variable', category: 'utilities', due_day: 15 },
  { name: 'Sewer', kind: 'variable', category: 'utilities', due_day: 15 },
  { name: 'Internet', kind: 'fixed', category: 'internet', due_day: 1 },
  { name: 'Gas', kind: 'variable', category: 'utilities', due_day: 15 },
] as const;

/** Set up a recurring bill once: name, fixed or varies, amount, due day, who pays the company. */
export default function BillEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { home } = useHousehold();
  const { wide } = useLayout();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'fixed' | 'variable'>('fixed');
  const [category, setCategory] = useState('utilities');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState(1);
  const [early, setEarly] = useState(0);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !home) return;
    api<{ data: Bill[] }>(`/v1/households/${home.id}/bills`).then((r) => {
      const b = r.data.find((x) => x.id === id);
      if (!b) return;
      setName(b.name); setKind(b.kind); setCategory(b.category); setDueDay(b.due_day); setEarly(b.post_days_early); setPayerId(b.payer_id);
      if (b.amount_cents) setAmount(`${Math.floor(b.amount_cents / 100)}.${String(b.amount_cents % 100).padStart(2, '0')}`);
    });
  }, [id, home]);

  const members = (home?.members ?? []).filter((m) => !m.former);
  const payer = payerId ?? home?.me.id;
  const cents = parseCents(amount);

  async function save() {
    if (!home) return;
    setBusy(true);
    setError(null);
    const body = { name: name.trim(), kind, category, due_day: dueDay, post_days_early: early, payer_id: payer, ...(kind === 'fixed' ? { amount_cents: cents } : {}) };
    try {
      if (id) await api(`/v1/bills/${id}`, { method: 'PATCH', body });
      else await api(`/v1/households/${home.id}/bills`, { body });
      router.back();
      toast.show({ text: id ? 'Bill updated. Everyone can see the change.' : `${name.trim()} added` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const go = async () => { await api(`/v1/bills/${id}`, { method: 'DELETE' }); router.back(); toast.show({ text: `${name} removed` }); };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Remove ${name}?`, 'Past months stay in the history. Future ones stop posting.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
  }

  const chip = (on: boolean) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' as const, borderWidth: on ? 1.5 : 1,
    borderColor: on ? HT.color.brand : HT.color.chipBorder, backgroundColor: on ? HT.color.brandTint : HT.color.surface });

  const ready = name.trim() && (kind === 'variable' || (cents ?? 0) > 0);

  return (
    <Screen maxWidth={wide ? 760 : HT.maxWidth.form} footer={<Button title={id ? 'Save bill' : 'Add bill'} onPress={save} loading={busy} disabled={!ready} />}>
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Close" onPress={() => router.back()}><CloseIcon /></IconButton>
          <T v="heading" accessibilityRole="header">{id ? 'Edit bill' : 'New bill'}</T>
          <View style={{ width: 44 }} />
        </View>
        {!id ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => (
              <Pressable key={p.name} accessibilityRole="button" onPress={() => { setName(p.name); setKind(p.kind); setCategory(p.category); setDueDay(p.due_day); }} style={chip(name === p.name)}>
                <T v="strong" style={{ fontSize: 13, color: name === p.name ? HT.color.brand : HT.color.ink }}>{p.name}</T>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Field label="Name" value={name} onChangeText={setName} placeholder="Rent" maxLength={40} />
        <View style={{ gap: 6 }}>
          <T v="label">Amount</T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: HT.color.segment, borderRadius: HT.radius.tile, padding: 4, gap: 6 }}>
            {(['fixed', 'variable'] as const).map((k) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityLabel={k === 'fixed' ? 'Same every month' : 'Changes every month'} accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)}
                style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === k ? HT.color.surface : 'transparent' }}>
                <T v="strong" style={{ color: kind === k ? HT.color.ink : HT.color.muted }}>{k === 'fixed' ? 'Same every month' : 'Changes'}</T>
              </Pressable>
            ))}
          </View>
        </View>
        {kind === 'fixed' ? (
          <Field label="Monthly amount" value={amount} onChangeText={(t) => setAmount(centsFirst(t))} keyboardType="number-pad" placeholder="0.00"
            hint={cents ? `${formatCents(cents)} · ${formatCents(Math.floor(cents / Math.max(1, members.length)))} each, split equally` : undefined} />
        ) : (
          <T v="muted">When it arrives, {payer === home?.me.id ? 'you get' : 'they get'} a reminder to type the amount or snap the bill. It posts the moment it's entered.</T>
        )}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
          <View style={{ flex: 1 }}><Stepper label={kind === 'fixed' ? 'Due on the' : 'Usually arrives around the'} value={dueDay} min={1} max={28} onChange={setDueDay} format={ordinal} /></View>
          {kind === 'fixed' ? (
            <View style={{ flex: 1 }}><Stepper label="Post early so people can pay ahead" value={early} min={0} max={7} onChange={setEarly} format={(v) => (v === 0 ? 'On the due day' : `${v} day${v > 1 ? 's' : ''} before`)} /></View>
          ) : null}
        </View>
        <View style={{ gap: 8 }}>
          <T v="label">Who pays the company?</T>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {members.map((m, i) => (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityLabel={m.you ? 'You' : m.first_name} accessibilityState={{ checked: payer === m.id }} onPress={() => setPayerId(m.id)} style={{ alignItems: 'center', gap: 4, minWidth: 52 }}>
                <View style={{ borderRadius: 26, padding: 2, borderWidth: 2, borderColor: payer === m.id ? HT.color.brand : 'transparent' }}>
                  <Avatar name={m.first_name} index={i} size={42} />
                </View>
                <T v="small" style={{ color: payer === m.id ? HT.color.brand : HT.color.muted }}>{m.you ? 'You' : m.first_name}</T>
              </Pressable>
            ))}
          </View>
        </View>
        <ErrorNote message={error} />
        {id ? <Button title="Remove this bill" kind="link" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}
