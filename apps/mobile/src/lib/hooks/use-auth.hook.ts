import { useSyncExternalStore } from 'react';

import { type AuthSession, authStore } from '@/lib/supabase';

/** The signed-in account, or `null` when using Coinroot without one (sign-in is optional). */
export function useAuth(): AuthSession | null {
  return useSyncExternalStore(authStore.subscribe, authStore.getSession, () => authStore.fallback);
}
