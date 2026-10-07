import { useEffect, useRef, useState } from "react";

/**
 * Countdown timer synced to server time.
 * `startedAt` and `limitSec` come from the state endpoint; `serverTime`
 * lets us correct for clock skew between client and server.
 * Returns whole seconds remaining (>= 0), or null when not applicable.
 */
export function useCountdown(
  startedAt: number | null | undefined,
  limitSec: number | null | undefined,
  serverTime: number | null | undefined
): number | null {
  const offsetRef = useRef<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (serverTime != null) {
      offsetRef.current = serverTime - Date.now();
    }
  }, [serverTime]);

  useEffect(() => {
    if (startedAt == null || limitSec == null) {
      setRemaining(null);
      return;
    }
    const compute = () => {
      const serverNow = Date.now() + offsetRef.current;
      const elapsed = (serverNow - startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(limitSec - elapsed)));
    };
    compute();
    const timer = setInterval(compute, 250);
    return () => clearInterval(timer);
  }, [startedAt, limitSec]);

  return remaining;
}
