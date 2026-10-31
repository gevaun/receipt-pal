import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getConnectionStatus, getTransactions, type ConnectionStatus, type Transaction } from "./api";
import { daysAgo, today } from "./format";
import { buildLookups, type Lookups } from "./lookups";

const VersionContext = createContext({ version: 0, invalidate: () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, invalidate }), [version, invalidate]);
  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

export function useInvalidate(): () => void {
  return useContext(VersionContext).invalidate;
}

interface Query<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useTransactions(start: string, end: string): Query<Transaction[]> {
  const { version } = useContext(VersionContext);
  const [state, setState] = useState<Query<Transaction[]>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    getTransactions(start, end, controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ data: s.data, error: error instanceof Error ? error.message : String(error), loading: false }));
      });
    return () => controller.abort();
  }, [start, end, version]);

  return state;
}

export function useLookups(): Lookups {
  const { data } = useTransactions(daysAgo(365), today());
  return useMemo(() => buildLookups(data ?? []), [data]);
}

export function useConnectionStatus(): ConnectionStatus | null {
  const { version } = useContext(VersionContext);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const check = () =>
      getConnectionStatus(controller.signal)
        .then(setStatus)
        .catch(() => {
          if (!controller.signal.aborted) setStatus(null);
        });
    void check();
    const timer = setInterval(check, 30_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [version]);

  return status;
}
