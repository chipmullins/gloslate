import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api, ApiError, type Household } from '@/lib/api';
import { useSession } from '@/lib/session';

// Last home we loaded, shared by every screen: a screen shows it instantly and
// refreshes in the background, instead of starting blank and waiting.
const cache = new Map<string, Household>();

/**
 * A home or group, reloaded whenever the screen gains focus. With no id it's
 * your home (the first one that isn't a group).
 */
export function useHousehold(householdId?: string) {
  const { households } = useSession();
  const id = householdId || households.find((h) => h.kind !== 'group')?.id;
  const [home, setHomeState] = useState<Household | null>(() => (id ? cache.get(id) ?? null : null));
  const setHome = useCallback((h: Household | null) => {
    if (h) cache.set(h.id, h);
    setHomeState(h);
  }, []);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ data: Household }>(`/v1/households/${id}`);
      setHome(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [id, setHome]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { home, error, reload, setHome };
}
