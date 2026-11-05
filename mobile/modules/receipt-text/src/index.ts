import { requireOptionalNativeModule } from 'expo';

type ReceiptTextNative = { recognize(uri: string): Promise<string[]> };

// Null in Expo Go and on web: the app falls back to typing the total.
const native = requireOptionalNativeModule<ReceiptTextNative>('ReceiptText');

export const receiptTextAvailable = !!native;

/** Text lines from a receipt photo, read on the device. */
export async function recognizeReceipt(uri: string): Promise<string[] | null> {
  if (!native) return null;
  return native.recognize(uri);
}
