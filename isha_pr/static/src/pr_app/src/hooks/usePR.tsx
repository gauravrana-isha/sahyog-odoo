import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet } from '../api';
import type { PRMe, Center } from '../types';

interface PRState {
  me: PRMe | null;
  loading: boolean;
  center: Center | null;
  setCenter: (c: Center) => void;
}

const PRContext = createContext<PRState>({
  me: null,
  loading: true,
  center: null,
  setCenter: () => {},
});

export function PRProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<PRMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<Center | null>(null);

  useEffect(() => {
    apiGet<PRMe>('/me')
      .then((data) => {
        setMe(data);
        if (data.centers.length) setCenter(data.centers[0]);
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PRContext.Provider value={{ me, loading, center, setCenter }}>
      {children}
    </PRContext.Provider>
  );
}

export function usePR(): PRState {
  return useContext(PRContext);
}
