import { router, type Href } from 'expo-router';

/**
 * Go back, or, when there's nothing to go back to (a web page opened
 * directly, a link from a notification), go somewhere sensible instead of
 * leaving the person stuck on the screen.
 */
export function goBack(fallback: Href = '/home' as Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
