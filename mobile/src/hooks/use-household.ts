import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api, ApiError, type Household } from '@/lib/api';
import { useSession } from '@/lib/session';

/** The current home (first one for now), reloaded whenever the screen gains focus. */
export function useHousehold() {
  const { households } = useSession();
  const id = households[0]?.id;
  const [home, setHome] = useState<Household | null>(null);
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
  }, [id]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { home, error, reload, setHome };
}
