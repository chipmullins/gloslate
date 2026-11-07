import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CheckIcon, HouseMark } from '@/components/icons';
import { Avatar, Button, Card, ErrorNote, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError, type InvitePreview } from '@/lib/api';
import { useSession } from '@/lib/session';

/** "Join Chip's home?" — opened from an invite link (tabitat://join/… or gloslate.app/i/…). */
export default function Join() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { token: session, setPendingInvite, refresh } = useSession();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [spot, setSpot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: InvitePreview }>(`/v1/invites/${token}`, { token: null })
      .then((r) => {
        setPreview(r.data);
        setSpot(r.data.for_member_id ?? (r.data.spots.length === 1 ? r.data.spots[0].id : null));
      })
      .catch(() => setError("This invite link doesn't work. Ask for a new one."));
  }, [token]);

  async function join() {
    if (!session) {
      setPendingInvite(token);
      router.replace('/welcome');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/invites/${token}/accept`, { body: spot ? { member_id: spot } : {} });
      setPendingInvite(null);
      await refresh();
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      maxWidth={HT.maxWidth.form}
      footer={preview?.open ? <Button title={session ? `Join ${preview.inviter}'s home` : 'Sign in to join'} onPress={join} loading={busy} /> : null}>
      <View style={{ gap: 22, paddingTop: 24, alignItems: 'stretch' }}>
        <HouseMark size={64} />
        {preview ? (
          <>
            <View style={{ gap: 8 }}>
              <T v="display" accessibilityRole="header">Join {preview.inviter}'s home?</T>
              <T v="muted">
                {preview.open ? `${preview.household_name} · ${preview.members.join(', ')}` : 'This invite has expired or was already used. Ask for a new link.'}
              </T>
            </View>
            {preview.open && preview.spots.length > 1 && !preview.for_member_id ? (
              <Card style={{ gap: 10 }}>
                <T v="heading">Which one is you?</T>
                {preview.spots.map((s, i) => {
                  const on = spot === s.id;
                  return (
                    <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSpot(s.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderRadius: HT.radius.tile, paddingHorizontal: 12,
                        borderWidth: on ? 2 : 1, borderColor: on ? HT.color.brand : HT.color.chipBorder, backgroundColor: on ? HT.color.brandTint : HT.color.surface }}>
                      <Avatar name={s.first_name} index={i + 1} size={34} />
                      <T v="strong" style={{ flex: 1 }}>{s.first_name}</T>
                      {on ? <CheckIcon size={18} color={HT.color.brand} /> : null}
                    </Pressable>
                  );
                })}
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: spot === null }} onPress={() => setSpot(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <T v="strong" style={{ color: spot === null ? HT.color.brand : HT.color.muted }}>I'm someone new</T>
                </Pressable>
              </Card>
            ) : null}
            {preview.open ? (
              <T v="small">Anything already logged with your name shows up the moment you join.</T>
            ) : null}
          </>
        ) : null}
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
