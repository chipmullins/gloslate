import { router } from 'expo-router';
import { useEffect } from 'react';

import { FullScreenLoader } from '@/components/bunny-loader';

/**
 * tabitat://auth/glofly is Glofly's return address. The browser sheet
 * (openAuthSessionAsync) already caught it; on Android the link can also
 * reach the router, which lands here. Step back to where sign-in started.
 */
export default function GloflyReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <FullScreenLoader label="Signing you in…" />;
}
