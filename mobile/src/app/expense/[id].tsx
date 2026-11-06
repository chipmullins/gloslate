import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { shortDate } from '@/components/expense-row';
import { BackIcon, FlagIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, Field, IconButton, Money, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLayout } from '@/hooks/use-layout';
import { api, ApiError, categoryLabel, type Expense } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { toast } from '@/lib/toast';

const SPLIT_LABEL = { equal: 'Split equally', percent: 'Split by percentage', exact: 'Split by exact amounts', shares: 'Split by shares' };

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { wide } = useLayout();
  const [e, setE] = useState<Expense | null>(null);
  const { home } = useHousehold(e?.household_id); // a group's item shows the group's people
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [flagNote, setFlagNote] = useState('');

  const load = useCallback(() => {
    api<{ data: Expense }>(`/v1/expenses/${id}`).then((r) => setE(r.data)).catch(() => setError("Couldn't load this."));
  }, [id]);
  useEffect(load, [load]);

  const members = home?.members ?? [];
  const nameOf = (mid: string | null) => {
    const m = members.find((x) => x.id === mid);
    return m ? (m.you ? 'You' : m.first_name) : mid ? 'Former member' : 'Gloslate';
  };
  const indexOf = (mid: string) => Math.max(0, members.findIndex((x) => x.id === mid));
  const initialOf = (mid: string | null) => members.find((x) => x.id === mid)?.first_name ?? '?';

  async function remove() {
    const go = async () => {
      try {
        await api(`/v1/expenses/${id}`, { method: 'DELETE' });
        router.back();
        toast.show({ text: 'Deleted', ms: 5000, action: { label: 'Undo', run: () => { api(`/v1/expenses/${id}/restore`, { body: {} }); } } });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this?', 'Everyone in it will see it was deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  }

  async function sendFlag() {
    try {
      await api(`/v1/expenses/${id}/flag`, { body: { note: flagNote } });
      setFlagging(false);
      setFlagNote('');
      toast.show({ text: `Sent to ${nameOf(e?.created_by_id ?? null)}` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  if (!e) return <Screen><ErrorNote message={error} /></Screen>;

  const title = e.description || categoryLabel(e.category);
  const summary = (
    <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
      <T v="muted">{categoryLabel(e.category)} · {shortDate(e.spent_on)}</T>
      <Money cents={e.amount_cents} size={44} />
      <T v="strong">{title}</T>
      <T v="small">
        {(e.payers?.length ?? 0) > 1
          ? e.payers!.map((p) => `${nameOf(p.member_id)} paid ${formatCents(p.cents)}`).join(' · ')
          : `${nameOf(e.payer_id)} paid`} · {SPLIT_LABEL[e.split_kind]}
      </T>
      {e.effect_for_me_cents !== 0 ? (
        <View style={{ marginTop: 8, backgroundColor: e.effect_for_me_cents > 0 ? HT.color.owedTint : '#FBEBDD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
          <T v="strong" style={{ color: e.effect_for_me_cents > 0 ? HT.color.owedToYou : HT.color.youOwe, fontSize: 14 }}>
            {e.effect_for_me_cents > 0 ? `You're owed ${formatCents(e.effect_for_me_cents)} for this` : `Your share: ${formatCents(-e.effect_for_me_cents)}`}
          </T>
        </View>
      ) : null}
    </Card>
  );

  const shares = (
    <View style={{ gap: 8 }}>
      <T v="heading">Who's in</T>
      <Card style={{ paddingVertical: 6 }}>
        {e.shares.map((s, i) => (
          <View key={s.member_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52,
            borderBottomWidth: i < e.shares.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
            <Avatar name={initialOf(s.member_id)} index={indexOf(s.member_id)} size={32} />
            <T v="strong" style={{ flex: 1 }}>{nameOf(s.member_id)}</T>
            <Money cents={s.cents} />
          </View>
        ))}
      </Card>
    </View>
  );

  const history = (
    <View style={{ gap: 8 }}>
      <T v="heading">History</T>
      <Card style={{ gap: 12 }}>
        {(e.history ?? []).map((h, i) => {
          const before = h.data?.before?.amount_cents;
          const after = h.data?.after?.amount_cents;
          const what = {
            'expense.created': 'added this',
            'expense.edited': before !== undefined && after !== undefined && before !== after ? `changed it from ${formatCents(before)} to ${formatCents(after)}` : 'edited this',
            'expense.deleted': 'deleted this',
            'expense.restored': 'brought this back',
            'expense.flagged': `said something's off: "${h.data?.note ?? ''}"`,
          }[h.kind] ?? h.kind;
          return (
            <View key={i} style={{ gap: 2 }}>
              <T v="body"><T v="strong">{nameOf(h.actor_member_id)}</T> {what}</T>
              <T v="small">{new Date(h.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</T>
            </View>
          );
        })}
      </Card>
    </View>
  );

  const actions = e.can_edit ? (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button title="Edit" kind="secondary" icon={<PencilIcon size={18} />} onPress={() => router.push(`/add?id=${e.id}${e.household_id ? `&hid=${e.household_id}` : ''}` as Href)} style={{ flex: 1 }} />
      <Button title="Delete" kind="secondary" icon={<TrashIcon size={18} color={HT.color.danger} />} onPress={remove} style={{ flex: 1 }} />
    </View>
  ) : flagging ? (
    <Card style={{ gap: 12 }}>
      <Field label="What looks off?" value={flagNote} onChangeText={setFlagNote} placeholder="I wasn't at this dinner" autoFocus />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" kind="secondary" onPress={() => setFlagging(false)} style={{ flex: 1 }} />
        <Button title={`Tell ${nameOf(e.created_by_id)}`} onPress={sendFlag} disabled={flagNote.trim().length < 3} style={{ flex: 1 }} />
      </View>
    </Card>
  ) : (
    <Button title="Something's off" kind="secondary" icon={<FlagIcon size={18} />} onPress={() => setFlagging(true)} />
  );

  return (
    <Screen maxWidth={wide ? 980 : HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => router.back()}><BackIcon /></IconButton>
        <ErrorNote message={error} />
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 18 }}>{summary}{actions}</View>
            <View style={{ flex: 1, gap: 18 }}>{shares}{history}</View>
          </View>
        ) : (
          <>
            {summary}
            {shares}
            {actions}
            {history}
          </>
        )}
      </View>
    </Screen>
  );
}
