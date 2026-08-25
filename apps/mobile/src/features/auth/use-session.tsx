import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '../../lib/supabase';

interface SessionState {
  session: Session | null;
  /** True until the stored session has been read back from AsyncStorage. */
  loading: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, loading: true });

/**
 * Auth state deliberately lives here rather than in the query cache.
 *
 * Putting the session in TanStack Query creates an invalidation loop between
 * "am I signed in" and "what am I allowed to see" during a token refresh.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    // Reading from storage is asynchronous, so without the loading flag the
    // first render looks signed out and bounces the user to the sign-in screen.
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
