import { Redirect, type Href } from 'expo-router';

import { useSession } from '@/lib/session';

/** Decides where to land: sign in → join a pending invite → onboarding (once per account) → Home, or Friends if there's no home. */
export default function Gate() {
  const { token, user, households, pendingInvite } = useSession();
  if (!token || !user) return <Redirect href="/welcome" />;
  if (pendingInvite?.startsWith('friend:')) return <Redirect href={`/friend/${pendingInvite.slice(7)}` as Href} />;
  if (pendingInvite) return <Redirect href={`/join/${pendingInvite}` as Href} />;
  // Onboarding is remembered on the account, so "just friends" (no tabs yet) doesn't loop back here.
  if (households.length === 0 && !user.onboarded_at) return <Redirect href={'/onboarding' as Href} />;
  // No home (friends-only, or joined a trip): start on Friends.
  if (!households.some((h) => h.kind !== 'group')) return <Redirect href={'/groups' as Href} />;
  return <Redirect href="/home" />;
}
