import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError, type Household } from '@/lib/api';
import { useSession } from '@/lib/session';

// Last copy of each home or group we loaded, shared by every screen: a screen
// shows it instantly and refreshes in the background instead of starting blank.
const cache = new Map<string, Household>();

/**
 * A home or group, reloaded whenever the screen gains focus. With no id it's
 * your home (the first one that isn't a group). If the id changes (a detail
 * screen learns which group it's in), the old one is never shown for the new
 * id, and a slow reply for an old id is ignored.
 */
export function useHousehold(householdId?: string) {
  const { households } = useSession();
  const id = householdId || households.find((h) => h.kind !== 'group')?.id;
  const [loaded, setLoaded] = useState<{ id: string; home: Household } | null>(() => {
    const c = id ? cache.get(id) : undefined;
    return id && c ? { id, home: c } : null;
  });
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(id);
  useEffect(() => { latest.current = id; }, [id]);

  const home = loaded && loaded.id === id ? loaded.home : id ? cache.get(id) ?? null : null;

  const setHome = useCallback((h: Household | null) => {
    if (!h) return setLoaded(null);
    cache.set(h.id, h);
    setLoaded({ id: h.id, home: h });
  }, []);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ data: Household }>(`/v1/households/${id}`);
      cache.set(id, res.data);
      if (latest.current !== id) return; // the screen moved on to another home or group
      setLoaded({ id, home: res.data });
      setError(null);
    } catch (e) {
      if (latest.current === id) setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { home, error, reload, setHome };
}
