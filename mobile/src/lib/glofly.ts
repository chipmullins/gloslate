import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api, type SignInResult } from '@/lib/api';
import { checkReturn, type GloflyReturn } from '@/lib/glofly-return';

export { checkReturn, GloflyError, type GloflyReturn } from '@/lib/glofly-return';

/**
 * Sign in with Glofly (OpenID Connect, code + PKCE). The server makes the PKCE
 * verifier, state and nonce and seals them in `flow`, so the app needs no
 * crypto (and no new native module). The app only opens Glofly's page,
 * checks `state` when it comes back, and hands the code to the server.
 *
 * Phones: the system browser sheet (expo-web-browser), back on tabitat://auth/glofly.
 * Web: the same tab goes to Glofly and comes back to /auth/glofly/callback.
 */
export const GLOFLY_APP_REDIRECT = 'tabitat://auth/glofly';
const PENDING_KEY = 'gloslate.glofly';

export type GloflyPurpose = 'sign_in' | 'link';
type Start = { authorize_url: string; state: string; flow: string };
type Pending = { purpose: GloflyPurpose; state: string; flow: string };

/** Should the "Continue with Glofly" button show? (Off until the server is configured.) */
export async function gloflyAvailable(): Promise<boolean> {
  try {
    return (await api<{ glofly?: boolean }>('/v1/auth/providers', { token: null })).glofly === true;
  } catch {
    return false;
  }
}

function redirectUri() {
  return Platform.OS === 'web' ? `${window.location.origin}/auth/glofly/callback` : GLOFLY_APP_REDIRECT;
}

/**
 * Opens Glofly. Phones: resolves with what came back (null if cancelled).
 * Web: leaves the page for Glofly; /auth/glofly/callback picks it up.
 */
export async function openGlofly(purpose: GloflyPurpose): Promise<GloflyReturn | null> {
  const start = await api<Start>(purpose === 'link' ? '/v1/identities/glofly/start' : '/v1/auth/glofly/start', {
    body: { redirect_uri: redirectUri() },
    ...(purpose === 'sign_in' ? { token: null } : {}),
  });
  if (Platform.OS === 'web') {
    const pending: Pending = { purpose, state: start.state, flow: start.flow };
    try { globalThis.sessionStorage?.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* checked on return */ }
    window.location.assign(start.authorize_url);
    return new Promise(() => {}); // the page is leaving
  }
  const res = await WebBrowser.openAuthSessionAsync(start.authorize_url, GLOFLY_APP_REDIRECT);
  if (res.type !== 'success') return null;
  return checkReturn(res.url, start);
}

/** Web only: the sign-in started in this tab before it went to Glofly (read once). */
export function takePending(): Pending | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(PENDING_KEY);
    globalThis.sessionStorage?.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

export function finishSignIn(r: GloflyReturn) {
  return api<SignInResult>('/v1/auth/glofly/finish', {
    token: null,
    body: { ...r, device_name: Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iPhone' : 'Android', platform: Platform.OS },
  });
}

export function finishLink(r: GloflyReturn) {
  return api('/v1/identities', { body: { provider: 'glofly', ...r } });
}

const METHOD_NAMES: Record<string, string> = { email: 'email', phone: 'phone number', apple: 'Apple ID', google: 'Google account' };
export function linkOfferMessage(existing: string[]) {
  return `You already have an account with that email. Sign in with your ${METHOD_NAMES[existing[0]] ?? existing[0]} first, then add Glofly in Settings → Sign-in methods.`;
}
