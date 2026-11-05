import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BackIcon } from '@/components/icons';
import { Card, IconButton, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { api, type NotificationItem } from '@/lib/api';

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useFocusEffect(useCallback(() => {
    api<{ data: NotificationItem[] }>('/v1/notifications').then((r) => {
      setItems(r.data);
      if (r.data.some((n) => !n.read)) api('/v1/notifications/read', { body: {} }).catch(() => {});
    }).catch(() => setItems([]));
  }, []));

  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => router.back()}><BackIcon /></IconButton>
        <T v="display" accessibilityRole="header">Notifications</T>
        <Card style={{ paddingVertical: 4 }}>
          {items && items.length === 0 ? <T v="muted" style={{ paddingVertical: 20, textAlign: 'center' }}>Nothing yet. When someone adds an expense with you in it, you'll see it here.</T> : null}
          {(items ?? []).map((n, i, arr) => (
            <Pressable key={n.id} accessibilityRole="button" disabled={!n.data.route} onPress={() => n.data.route && router.push(n.data.route as Href)}
              style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: HT.color.hairline }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: n.read ? 'transparent' : HT.color.brand }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="strong">{n.title}</T>
                <T v="muted">{n.body}</T>
                <T v="small">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</T>
              </View>
            </Pressable>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
