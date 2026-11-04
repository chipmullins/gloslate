import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, tokenStore, type HouseholdSummary, type User } from '@/lib/api';

type SessionState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  households: HouseholdSummary[];
  /** Invite link opened before signing in; consumed after sign-in. */
  pendingInvite: string | null;
  setPendingInvite: (token: string | null) => void;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  const load = useCallback(async (t: string | null) => {
    if (!t) {
      setUser(null);
      setHouseholds([]);
      return;
    }
    try {
      const [me, homes] = await Promise.all([
        api<User>('/v1/me', { token: t }),
        api<{ data: HouseholdSummary[] }>('/v1/households', { token: t }),
      ]);
      setUser(me);
      setHouseholds(homes.data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await tokenStore.set(null);
        setToken(null);
        setUser(null);
      } else {
        throw e;
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await tokenStore.get();
      setToken(t);
      await load(t).catch(() => {});
      setReady(true);
    })();
  }, [load]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      token,
      user,
      households,
      pendingInvite,
      setPendingInvite,
      async signIn(t) {
        await tokenStore.set(t);
        setToken(t);
        await load(t);
      },
      async signOut() {
        await api('/v1/session', { method: 'DELETE' }).catch(() => {});
        await tokenStore.set(null);
        setToken(null);
        setUser(null);
        setHouseholds([]);
      },
      refresh: () => load(token),
    }),
    [ready, token, user, households, pendingInvite, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
