import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Navigate } from 'react-router-dom';
import { apiGet } from '../api';
import type { Me, Capabilities } from '../types';

interface CapabilitiesState {
  me: Me | null;
  loading: boolean;
}

const CapabilitiesContext = createContext<CapabilitiesState>({
  me: null,
  loading: true,
});

/** Fetches /api/me once and shares it app-wide so navigation and routes are
 *  driven by a single source of truth. */
export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Me>('/me')
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CapabilitiesContext.Provider value={{ me, loading }}>
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): CapabilitiesState {
  return useContext(CapabilitiesContext);
}

/**
 * Returns a predicate `can(key)`. Optimistic while /api/me is still loading
 * (returns true) so the UI does not flicker — this is purely cosmetic gating;
 * the backend enforces access on every request regardless.
 */
export function useCan(): (key: keyof Capabilities) => boolean {
  const { me } = useCapabilities();
  return (key) => (me ? !!me.can[key] : true);
}

/** Route guard: redirects home once capabilities are known and the required
 *  capability is absent. Cosmetic — the API still enforces access. */
export function Protected({
  cap,
  children,
}: {
  cap: keyof Capabilities;
  children: ReactNode;
}) {
  const { me } = useCapabilities();
  if (me && !me.can[cap]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
