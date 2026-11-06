import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { toast } from '@/lib/toast';

/**
 * Share a link (a request or an invite). Phones and browsers with a share
 * sheet get it; a desktop browser without one copies the link instead and
 * says so, so sending never just fails.
 */
export async function shareLink(message: string, url: string) {
  const canSheet = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  if (canSheet) {
    try {
      await Share.share({ message, url });
      return;
    } catch (e) {
      if (Platform.OS !== 'web') throw e;
      // The browser refused the sheet (or it was closed): fall back to copying.
      if (e instanceof Error && e.name === 'AbortError') return;
    }
  }
  await Clipboard.setStringAsync(message.includes(url) ? message : `${message} ${url}`);
  toast.show({ text: 'Link copied. Paste it in a text or email.' });
}
