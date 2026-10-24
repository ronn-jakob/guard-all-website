import { useCallback, useEffect, useRef, useState } from "react";

// Minimal, dependency-free async data hook. It mirrors the effect pattern the
// screens already used: run on mount, re-run when `deps` change, ignore a
// response that arrives after unmount, and expose loading/error state.
//
// `fetcher` is read through a ref so callers do not need to memoise it.
// `reload()` forces a refetch without changing the deps.
export function useAsyncData(fetcher, deps = [], options = {}) {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled);
  const [reloadToken, setReloadToken] = useState(0);
  const fetcherRef = useRef(fetcher);

  // Keep the latest fetcher without making callers memoise it. Declared before
  // the request effect so the first run sees the current function.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    // The request is the effect's purpose, so setting the loading flag here is
    // intentional (same pattern the screens used before this hook existed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    fetcherRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : String(requestError),
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // `deps` is intentionally spread: every caller passes the exact values its
    // request depends on, and the token re-runs it on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    data,
    error,
    isLoading: enabled ? isLoading : false,
    reload,
    setData,
  };
}
