import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { FullScreenLoader } from '@/components/bunny-loader';
import { Button, ErrorNote, Screen, T } from '@/components/ui';
import { HT } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { checkReturn, finishLink, finishSignIn, GloflyError, linkOfferMessage, takePending } from '@/lib/glofly';
import { useSession } from '@/lib/session';
import { toast } from '@/lib/toast';

/** Web app: Glofly sends the tab back here (https://app.gloslate.app/auth/glofly/callback?code=…&state=…). */
export default function GloflyCallback() {
  const { signIn, refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [startedFrom, setStartedFrom] = useState<Href>('/welcome');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || Platform.OS !== 'web') return;
    ran.current = true;
    (async () => {
      const returned = window.location.href;
      window.history.replaceState(null, '', '/auth/glofly/callback'); // drop the code from the address bar and history
      const pending = takePending();
      if (!pending) return setError('That sign-in expired. Start again.');
      if (pending.purpose === 'link') setStartedFrom('/sign-in-methods' as Href);
      try {
        const back = checkReturn(returned, pending);
        if (!back) {
          router.replace(pending.purpose === 'link' ? ('/sign-in-methods' as Href) : '/welcome');
          toast.show({ text: 'Sign-in cancelled.' });
          return;
        }
        if (pending.purpose === 'link') {
          await finishLink(back);
          await refresh();
          toast.show({ text: 'Added Glofly. You can sign in with it now.' });
          router.replace('/sign-in-methods' as Href);
          return;
        }
        const res = await finishSignIn(back);
        if (res.status === 'signed_in') {
          await signIn(res.token);
          router.replace('/');
        } else {
          setError(linkOfferMessage(res.existing_methods));
        }
      } catch (e) {
        setError(e instanceof ApiError || e instanceof GloflyError ? e.message : "Couldn't sign in with Glofly. Try again.");
      }
    })();
  }, [signIn, refresh]);

  if (!error) return <FullScreenLoader label="Signing you in…" />;
  return (
    <Screen maxWidth={HT.maxWidth.form}>
      <View style={{ gap: 16, paddingTop: 48 }}>
        <T v="heading" accessibilityRole="header">Glofly sign-in didn’t finish</T>
        <ErrorNote message={error} />
        <Button title="Go back" onPress={() => router.replace(startedFrom)} />
      </View>
    </Screen>
  );
}
