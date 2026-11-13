import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { CameraIcon, GloflyGlyph, TrashIcon } from '@/components/icons';
import { Section, SettingsPage, useMySettings } from '@/components/settings';
import { Avatar, Button, Field, T } from '@/components/ui';
import { api, ApiError, uploadPhoto } from '@/lib/api';
import { prettyPhone } from '@/lib/phone';
import { toast } from '@/lib/toast';

/** Your name and profile photo (canvas "Profile photo"). */
export default function ProfileSettings() {
  const { user, error, setError, patchMe, refresh } = useMySettings();
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(user?.first_name);
  if (user && user.first_name !== loaded) { setLoaded(user.first_name); setFirstName(user.first_name); }
  if (!user) return null;

  async function save(kind: string, fn: () => Promise<unknown>, done: string) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      await refresh();
      toast.show({ text: done });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the photo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function pick(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Allow camera access in Settings to take a photo.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    await save(source, () => uploadPhoto(a.uri, a.mimeType), 'Photo saved');
  }

  return (
    <SettingsPage title="Profile" error={error}>
      <Section>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
          <Avatar name={user.first_name || '?'} size={96} photo={user.photo_url} />
          <T v="title">{user.first_name}</T>
          <T v="small">{[user.phone ? prettyPhone(user.phone) : null, user.email].filter(Boolean).join(' · ')}</T>
        </View>
        <Field label="First name" value={firstName} onChangeText={setFirstName}
          onEndEditing={() => firstName.trim() && firstName !== user.first_name && patchMe({ first_name: firstName.trim() }, 'Saved')} />
      </Section>

      <Section title="Profile photo">
        <T v="small">Seen by people you share a tab with and your friends. Never on request pages.</T>
        {Platform.OS !== 'web' ? (
          <Button title="Take a photo" kind="secondary" icon={<CameraIcon size={18} />} loading={busy === 'camera'} disabled={!!busy} onPress={() => pick('camera')} />
        ) : null}
        <Button title="Choose from library" kind="secondary" loading={busy === 'library'} disabled={!!busy} onPress={() => pick('library')} />
        {user.glofly_photo ? (
          <Button title="Use my Glofly photo" kind="secondary" icon={<GloflyGlyph size={18} />} loading={busy === 'glofly'} disabled={!!busy}
            onPress={() => save('glofly', () => api('/v1/me/photo', { method: 'POST', body: { from: 'glofly' } }), 'Using your Glofly photo')} />
        ) : null}
        {user.photo_url ? (
          <Button title="Remove photo" kind="link" icon={<TrashIcon size={16} />} disabled={!!busy}
            onPress={() => save('remove', () => api('/v1/me/photo', { method: 'DELETE' }), 'Photo removed')} />
        ) : null}
      </Section>
    </SettingsPage>
  );
}
