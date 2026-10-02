import { useEffect, useRef, useState } from "react";

/**
 * Polls `fn` every `intervalMs`. Skips ticks while the tab is hidden so
 * background devices don't burn through the Workers free-tier request quota.
 */
export function usePoll<T>(fn: () => Promise<T>, intervalMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (document.hidden) {
        timer = setTimeout(tick, intervalMs);
        return;
      }
      try {
        const d = await fnRef.current();
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Request failed");
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };

    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);

  return { data, error };
}
