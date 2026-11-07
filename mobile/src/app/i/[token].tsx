import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Universal-link path (https://gloslate.app/i/TOKEN) → the join screen. */
export default function InviteLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={`/join/${token}` as Href} />;
}
