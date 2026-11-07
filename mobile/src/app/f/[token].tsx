import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Universal-link path (https://gloslate.app/f/TOKEN) → the add-a-friend screen. */
export default function FriendLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={`/friend/${token}` as Href} />;
}
