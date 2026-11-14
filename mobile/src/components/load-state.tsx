import { type Href } from 'expo-router';
import { View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { BackIcon } from '@/components/icons';
import { Button, ErrorNote, IconButton, Screen } from '@/components/ui';
import { goBack } from '@/lib/nav';

/** A screen still loading (the bunny) or that couldn't load (a way back, and Try again). */
export function LoadState({ error, back = '/home', onRetry, label }: { error?: string | null; back?: string; onRetry?: () => void; label?: string }) {
  if (!error) return <FullScreenLoader label={label} />;
  return (
    <Screen>
      <View style={{ gap: 18 }}>
        <IconButton label="Back" onPress={() => goBack(back as Href)}><BackIcon /></IconButton>
        <ErrorNote message={error} />
        {onRetry ? <Button title="Try again" kind="secondary" onPress={onRetry} /> : null}
      </View>
    </Screen>
  );
}
