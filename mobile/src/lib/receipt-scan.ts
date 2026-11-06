import * as ImagePicker from 'expo-image-picker';

import { recognizeReceipt } from '../../modules/receipt-text/src';
import { parseReceipt, type ParsedReceipt } from '@/lib/receipt';

/** Take or pick a receipt photo, then read it on the device. */
export async function scanReceipt(source: 'camera' | 'library'): Promise<{ uri: string; parsed: ParsedReceipt | null } | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Gloslate needs the camera to scan receipts. You can turn it on in Settings.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const uri = res.assets[0].uri;
  const lines = await recognizeReceipt(uri).catch(() => null);
  return { uri, parsed: lines ? parseReceipt(lines) : null };
}
