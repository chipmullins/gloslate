import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { API_BASE, tokenStore } from '@/lib/api';

/** Downloads an authenticated file (PDF statement, CSV, my data) and opens the share sheet. */
export async function downloadAndShare(path: string, filename: string, mimeType: string) {
  const token = await tokenStore.get();
  if (Platform.OS === 'web') {
    await Linking.openURL(`${API_BASE}${path}`);
    return;
  }
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create();
  const dest = new File(dir, filename);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(`${API_BASE}${path}`, dest, { headers: { Authorization: `Bearer ${token}` } });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}
