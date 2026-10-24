import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';

import { reducer, type Action } from './reducer';
import type { AppState, TripData } from './types';

/**
 * Local-first store for the MVP: everything lives on this device (localStorage on web).
 * The API replaces this in Phase 1+, keeping the same actions as mutations.
 */
const STORAGE_KEY = 'yallist/v1';

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { trips: {} });
  const hydrated = useRef(false);
  const [ready, setReady] = useReducer(() => true, false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'hydrate', state: JSON.parse(raw) as AppState });
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
        setReady();
      });
  }, []);

  useEffect(() => {
    if (hydrated.current) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  if (!ready) return null;
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (!state) throw new Error('useAppState outside StoreProvider');
  return state;
}

export function useDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useDispatch outside StoreProvider');
  return dispatch;
}

/** The signed-in user. Only call under the `(app)` group, which guarantees one. */
export function useMe() {
  const me = useAppState().me;
  if (!me) throw new Error('useMe without a signed-in user');
  return me;
}

export function useTrip(tripId: string | undefined): TripData | undefined {
  const trips = useAppState().trips;
  return tripId ? trips[tripId] : undefined;
}
