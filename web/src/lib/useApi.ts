import { useEffect, useRef, useState } from "react";

export type ApiState<T> =
  | { status: "loading"; data?: undefined; error?: undefined; httpStatus?: undefined }
  | { status: "error"; data?: undefined; error: string; httpStatus?: number }
  | { status: "ok"; data: T; error?: undefined; httpStatus?: undefined };

/**
 * Runs an api.ts fetcher on mount (and whenever `deps` changes), tracking
 * loading/error/data state. Every panel stub uses this so panel agents don't
 * need to hand-roll fetch/loading/error boilerplate.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
            httpStatus:
              err && typeof err === "object" && "status" in err
                ? (err as { status: number }).status
                : undefined,
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
