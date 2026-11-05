import { Redirect, type Href } from 'expo-router';

import { useSession } from '@/lib/session';

/** Decides where to land: sign in → join a pending invite → set up a home → Home. */
export default function Gate() {
  const { token, user, households, pendingInvite } = useSession();
  if (!token || !user) return <Redirect href="/welcome" />;
  if (pendingInvite) return <Redirect href={`/join/${pendingInvite}` as Href} />;
  if (households.length === 0) return <Redirect href="/setup" />;
  return <Redirect href="/home" />;
}
