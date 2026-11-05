import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { Button, ErrorNote, Field, Screen, Steps, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { parseCents } from '@/lib/money';

const OPTIONS = [
  { key: 'rent', label: 'Rent', fixed: true },
  { key: 'electric', label: 'Electric', fixed: false },
  { key: 'water', label: 'Water', fixed: false },
  { key: 'sewer', label: 'Sewer', fixed: false },
  { key: 'internet', label: 'Internet', fixed: true },
  { key: 'gas', label: 'Gas', fixed: false },
];

/** First run, step 2: "What bills do you split?" */
export default function SetupBills() {
  const { householdId, memberId } = useLocalSearchParams<{ householdId: string; memberId: string }>();
  const [picked, setPicked] = useState<string[]>(['rent']);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, string>>({ rent: '1', internet: '1' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => router.replace({ pathname: '/setup/handles', params: { householdId, memberId } });
  const fixedPicked = OPTIONS.filter((o) => o.fixed && picked.includes(o.key));
  const ready = fixedPicked.every((o) => (parseCents(amounts[o.key] ?? '') ?? 0) > 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const key of picked) {
        const opt = OPTIONS.find((o) => o.key === key)!;
        const day = Math.min(28, Math.max(1, Number(days[key] || (opt.fixed ? 1 : 15))));
        await api(`/v1/households/${householdId}/bills`, {
          body: { preset: key, due_day: day, ...(opt.fixed ? { amount_cents: parseCents(amounts[key] ?? '') } : {}) },
        });
      }
      next();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={HT.maxWidth.form} footer={
      <View style={{ gap: 4 }}>
        <Button title={picked.length ? 'Continue' : 'Skip for now'} kind={picked.length ? 'primary' : 'secondary'} onPress={picked.length ? save : next} loading={busy} disabled={!!picked.length && !ready} />
      </View>
    }>
      <View style={{ gap: 22, paddingTop: 8 }}>
        <Steps total={3} current={2} />
        <View style={{ gap: 8 }}>
          <T v="display" accessibilityRole="header">What bills do you split?</T>
          <T v="muted">Each one posts itself when it's due. Bills that change each month ask whoever pays them for the amount.</T>
        </View>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o) => {
            const on = picked.includes(o.key);
            return (
              <View key={o.key} style={{ backgroundColor: HT.color.surface, borderRadius: HT.radius.tile, borderWidth: on ? 1.5 : 1, borderColor: on ? HT.color.brand : HT.color.chipBorder, padding: 12, gap: 10 }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o.label}
                  onPress={() => setPicked((cur) => (on ? cur.filter((k) => k !== o.key) : [...cur, o.key]))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: on ? 0 : 1.5, borderColor: HT.color.chipBorder, backgroundColor: on ? HT.color.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <CheckIcon size={15} color="#fff" /> : null}
                  </View>
                  <T v="strong" style={{ flex: 1 }}>{o.label}</T>
                  <T v="small">{o.fixed ? 'Same each month' : 'Changes'}</T>
                </Pressable>
                {on && o.fixed ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 2 }}><Field label="Amount" value={amounts[o.key] ?? ''} onChangeText={(t) => setAmounts((a) => ({ ...a, [o.key]: t }))} keyboardType="decimal-pad" placeholder="1800.00" /></View>
                    <View style={{ flex: 1 }}><Field label="Due day" value={days[o.key] ?? ''} onChangeText={(t) => setDays((d) => ({ ...d, [o.key]: t.replace(/\D/g, '').slice(0, 2) }))} keyboardType="number-pad" placeholder="1" /></View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
