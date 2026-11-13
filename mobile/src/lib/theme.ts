import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import { applyScheme, HT, type Scheme } from '@/constants/theme';

/**
 * Light / dark mode, saved on this device. "Match phone" needs the native app to allow
 * dark mode (app.json userInterfaceStyle "automatic"); until that build ships, iOS and
 * Android always report light, so the choice is only offered once it can work.
 */
export type ThemePref = 'system' | 'light' | 'dark';

export const canMatchPhone = Constants.expoConfig?.userInterfaceStyle === 'automatic';

const WEB_KEY = 'gloslate.theme';
const file = () => new File(Paths.document, 'theme.txt');
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(WEB_KEY) : file().exists ? file().textSync() : null;
    if (raw === 'light' || raw === 'dark' || (raw === 'system' && canMatchPhone)) return raw;
  } catch {
    // Unreadable: fall back to the default.
  }
  return canMatchPhone ? 'system' : 'light';
}

let pref: ThemePref = read();
const resolve = (p: ThemePref): Scheme => (p === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : p);
applyScheme(resolve(pref));

function update() {
  const next = resolve(pref);
  if (next === HT.scheme) return;
  applyScheme(next);
  listeners.forEach((l) => l());
}

Appearance.addChangeListener(() => { if (pref === 'system') update(); });

export const theme = {
  get pref() { return pref; },
  set(p: ThemePref) {
    pref = p;
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(WEB_KEY, p);
      else file().write(p);
    } catch {
      // Still applies for this run.
    }
    update();
  },
};

/** The scheme in use; the root keys its tree on this so every screen re-reads the colors. */
export function useScheme(): Scheme {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => HT.scheme);
}
