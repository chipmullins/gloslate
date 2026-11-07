import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HouseMark } from '@/components/icons';
import { Button, ErrorNote, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

type Preview = { first_name: string; you: boolean; already: boolean };

/** "Add Chip as a friend?" — opened from someone's friend link (gloslate.app/f/… or tabitat://friend/…). */
export default function AddFriend() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { token: session, setPendingInvite, refresh } = useSession();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return; // the name shows after signing in
    api<{ data: Preview }>(`/v1/friends/preview?token=${encodeURIComponent(token)}`)
      .then((r) => setPreview(r.data))
      .catch(() => setError("This friend link doesn't work anymore. Ask for a new one."));
  }, [token, session]);

  async function add() {
    if (!session) {
      setPendingInvite(`friend:${token}`);
      router.replace('/welcome');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/v1/friends', { body: { token } });
      setPendingInvite(null);
      await refresh();
      toast.show({ text: `You and ${preview?.first_name ?? 'your friend'} are friends now.` });
      router.replace('/groups' as Href);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const name = preview?.first_name || 'your friend';
  const done = preview?.already || preview?.you;
  return (
    <Screen maxWidth={HT.maxWidth.form}
      footer={done ? <Button title="Go to Friends" onPress={() => { setPendingInvite(null); router.replace('/groups' as Href); }} />
        : <Button title={session ? `Add ${name}` : 'Sign in to add them'} onPress={add} loading={busy} disabled={!!session && !preview} />}>
      <View style={{ gap: 18, paddingTop: 24 }}>
        <HouseMark size={64} />
        <T v="display" accessibilityRole="header">
          {preview?.you ? "That's your own link" : preview?.already ? `You and ${name} are already friends` : `Add ${session ? name : 'a friend'} on Gloslate?`}
        </T>
        <T v="muted">
          {preview?.you ? 'Send it to someone so they can add you.'
            : 'Friends can send each other what they owe right in Gloslate: it shows up as a notification, no texting links back and forth.'}
        </T>
        <ErrorNote message={error} />
      </View>
    </Screen>
  );
}
