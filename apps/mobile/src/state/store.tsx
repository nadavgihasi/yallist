import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { setAuth, signOut as endSession, statusOf, type AuthResult } from '@/lib/api';

import { cacheBuster } from './cacheBuster';
import type { Me } from './types';

/**
 * The session (bearer token and user, in AsyncStorage: localStorage on web) and the API data
 * (TanStack Query, its cache persisted too, so trips still open with weak reception).
 */
const SESSION_KEY = 'yallist/session';
const WEEK = 7 * 24 * 60 * 60 * 1000;

interface Session {
  token: string;
  me: Me;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: WEEK,
      staleTime: 10_000,
      // Network and server errors are worth retrying; a 4xx answer won't change.
      retry: (count, error) => count < 3 && (statusOf(error) ?? 500) >= 500,
    },
  },
});

// One object: the provider restores the cache again whenever this changes.
const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'yallist/cache' }),
  maxAge: WEEK,
  // A new build drops the old cache rather than restoring data in a stale shape.
  buster: cacheBuster(process.env.EXPO_PUBLIC_GIT_SHA),
};

interface SessionContext {
  me?: Me;
  signIn: (result: AuthResult) => Promise<void>;
  /** Ends the session here even when the server can't be reached. */
  signOut: () => Promise<void>;
}

const Context = createContext<SessionContext | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // undefined while loading; null when signed out.
  const [session, setSession] = useState<Session | null>();

  const forget = () => {
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    queryClient.clear();
    activate(null);
  };

  const activate = (next: Session | null) => {
    setAuth(next?.token, () => {
      // The session expired or was revoked: back to the login screen, saying why.
      showToast(he.errors.sessionExpired);
      forget();
    });
    setSession(next);
  };

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .catch(() => null)
      .then((raw) => activate(raw ? (JSON.parse(raw) as Session) : null));
    // Once, on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async ({ token, user }: AuthResult) => {
    const next = { token, me: { userId: user.id, name: user.name } };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    // Another user's cached trips must never show.
    queryClient.clear();
    activate(next);
  };

  const signOut = async () => {
    await endSession().catch(() => {});
    forget();
  };

  if (session === undefined) return null;
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <Context.Provider value={{ me: session?.me, signIn, signOut }}>{children}</Context.Provider>
    </PersistQueryClientProvider>
  );
}

export function useSession(): SessionContext {
  const session = useContext(Context);
  if (!session) throw new Error('useSession outside StoreProvider');
  return session;
}

/** The signed-in user. Only call under the `(app)` group, which guarantees one. */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error('useMe without a signed-in user');
  return me;
}
